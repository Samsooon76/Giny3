#!/usr/bin/env perl
use strict;
use JSON::PP qw(decode_json encode_json);
use warnings;

use IO::Select;
use IO::Socket::INET;
use IPC::Open3;
use Symbol qw(gensym);
use Time::HiRes qw(time);

my $host = $ENV{GINY_AUTH_HOST} // '127.0.0.1';
my $port = $ENV{GINY_AUTH_PORT} // 8443;
my $username = $ENV{GINY_TEST_USERNAME} // 'admin';
my $password = $ENV{GINY_TEST_PASSWORD} // 'test';
my $server_id = $ENV{GINY_TEST_SERVER_ID} // 50;
my $protocol = '1.0.3+56e1f37';

my $socket = IO::Socket::INET->new(
    PeerAddr => $host,
    PeerPort => $port,
    Proto    => 'tcp',
    Timeout  => 5,
) or die "Connexion impossible à $host:$port : $!\n";

$socket->autoflush(1);
my $selector = IO::Select->new($socket);

sub read_exact {
    my ($length) = @_;
    my $data = '';

    while (length($data) < $length) {
        $selector->can_read(5)
            or die "Délai dépassé pendant la lecture du serveur.\n";
        my $read = sysread($socket, my $chunk, $length - length($data));
        defined($read) or die "Erreur de lecture : $!\n";
        $read > 0 or die "Le serveur Auth a fermé la connexion.\n";
        $data .= $chunk;
    }

    return $data;
}

sub read_frame {
    my $header = unpack('n', read_exact(2));
    my $length_type = $header & 3;
    my $message_id = $header >> 2;
    my $length = 0;

    if ($length_type == 1) {
        $length = unpack('C', read_exact(1));
    } elsif ($length_type == 2) {
        $length = unpack('n', read_exact(2));
    } elsif ($length_type == 3) {
        my ($high, $low) = unpack('Cn', read_exact(3));
        $length = ($high << 16) | $low;
    }

    return ($message_id, read_exact($length));
}

sub pack_frame {
    my ($message_id, $payload) = @_;
    my $length = length($payload);
    my ($length_type, $encoded_length);

    if ($length == 0) {
        ($length_type, $encoded_length) = (0, '');
    } elsif ($length <= 255) {
        ($length_type, $encoded_length) = (1, pack('C', $length));
    } elsif ($length <= 65535) {
        ($length_type, $encoded_length) = (2, pack('n', $length));
    } else {
        ($length_type, $encoded_length) = (
            3,
            pack('Cn', ($length >> 16) & 0xff, $length & 0xffff),
        );
    }

    # Les paquets client -> serveur incluent un identifiant d'instance uint32
    # entre l'en-tête et la taille. Les réponses serveur n'en contiennent pas.
    return pack('nN', ($message_id << 2) | $length_type, 0)
        . $encoded_length
        . $payload;
}

sub pack_varint {
    my ($value) = @_;
    my $encoded = '';
    do {
        my $byte = $value & 0x7f;
        $value >>= 7;
        $byte |= 0x80 if $value;
        $encoded .= pack('C', $byte);
    } while ($value);
    return $encoded;
}

sub unpack_varint {
    my ($data, $offset_ref) = @_;
    my ($value, $shift) = (0, 0);

    while (1) {
        $$offset_ref < length($data)
            or die "Paquet tronqué pendant la lecture d'un VarInt.\n";
        my $byte = unpack('C', substr($data, $$offset_ref, 1));
        $$offset_ref++;
        $value |= ($byte & 0x7f) << $shift;
        return $value if ($byte & 0x80) == 0;
        $shift += 7;
        $shift <= 35 or die "VarInt invalide.\n";
    }
}

sub unpack_u16 {
    my ($data, $offset_ref) = @_;
    $$offset_ref + 2 <= length($data) or die "Paquet uint16 tronqué.\n";
    my $value = unpack('n', substr($data, $$offset_ref, 2));
    $$offset_ref += 2;
    return $value;
}

sub unpack_u8 {
    my ($data, $offset_ref) = @_;
    $$offset_ref < length($data) or die "Paquet uint8 tronqué.\n";
    return unpack('C', substr($data, $$offset_ref++, 1));
}

sub unpack_utf {
    my ($data, $offset_ref) = @_;
    my $length = unpack_u16($data, $offset_ref);
    $$offset_ref + $length <= length($data) or die "Chaîne UTF tronquée.\n";
    my $value = substr($data, $$offset_ref, $length);
    $$offset_ref += $length;
    return $value;
}

sub pack_utf {
    my ($value) = @_;
    length($value) <= 65535 or die "Chaîne trop longue pour WriteUTF.\n";
    return pack('n', length($value)) . $value;
}

sub decrypt_ticket {
    my ($encrypted) = @_;
    my $error = gensym;
    my $pid = open3(
        my $input,
        my $output,
        $error,
        'openssl', 'enc', '-d', '-aes-256-cbc',
        '-K', ('0' x 64),
        '-iv', ('0' x 32),
    );
    binmode($input);
    binmode($output);
    print {$input} $encrypted;
    close($input);
    local $/;
    my $decrypted = <$output> // '';
    my $error_text = <$error> // '';
    waitpid($pid, 0);
    $? == 0 or die "Impossible de déchiffrer le ticket AES : $error_text";
    return $decrypted;
}

my ($protocol_id, $protocol_payload) = read_frame();
$protocol_id == 1939
    or die "Handshake inattendu : message $protocol_id au lieu de ProtocolRequired (1939).\n";

my $protocol_length = unpack('n', substr($protocol_payload, 0, 2));
my $server_protocol = substr($protocol_payload, 2, $protocol_length);
$server_protocol eq $protocol
    or die "Protocole incompatible : serveur=$server_protocol, client=$protocol.\n";

my ($hello_id) = read_frame();
$hello_id == 5586
    or die "Handshake inattendu : message $hello_id au lieu de HelloConnectMessage (5586).\n";

my $credentials = pack('n', length($username)) . $username
    . pack('n', length($password)) . $password
    . ("\0" x 32);
length($credentials) <= 127
    or die "Les identifiants du smoke test sont trop longs.\n";

my $identification_payload = pack('C', 0)                 # indicateurs booléens
    . pack('C3NC', 2, 73, 3, 14, 0)                      # Version 2.73.3.14
    . pack('n', 2) . 'fr'
    . pack('C', length($credentials)) . $credentials
    . pack('n', 0)                                        # serverId
    . pack('C', 0)                                        # sessionOptionalSalt (VarLong)
    . pack('n', 0);                                       # failedAttempts

print $socket pack_frame(9262, $identification_payload)
    or die "Impossible d'envoyer IdentificationMessage : $!\n";

my %received;
my $deadline = time() + 5;
while (time() < $deadline && (!$received{6104} || !$received{9500})) {
    my ($message_id) = read_frame();
    $received{$message_id} = 1;
}

$received{6104}
    or die "IdentificationSuccessMessage (6104) non reçu. Messages : "
        . join(', ', sort { $a <=> $b } keys %received) . "\n";
$received{9500}
    or die "ServersListMessage (9500) non reçu. Messages : "
        . join(', ', sort { $a <=> $b } keys %received) . "\n";

print $socket pack_frame(4134, pack_varint($server_id))
    or die "Impossible d'envoyer ServerSelectionMessage : $!\n";

my ($selected_server_message_id, $selected_server_payload) = read_frame();
$selected_server_message_id == 4944
    or die "Sélection du monde refusée : message $selected_server_message_id au lieu de SelectedServerDataMessage (4944).\n";

my $offset = 0;
my $selected_server_id = unpack_varint($selected_server_payload, \$offset);
my $world_host = unpack_utf($selected_server_payload, \$offset);
my $world_port_count = unpack_u16($selected_server_payload, \$offset);
$world_port_count > 0 or die "Le monde sélectionné ne fournit aucun port.\n";
my @world_ports = map { unpack_varint($selected_server_payload, \$offset) }
    1 .. $world_port_count;
my $can_create_character = unpack_u8($selected_server_payload, \$offset);
my $encrypted_ticket_length = unpack_varint($selected_server_payload, \$offset);
$offset + $encrypted_ticket_length <= length($selected_server_payload)
    or die "Ticket de monde tronqué.\n";
my $encrypted_ticket = substr(
    $selected_server_payload,
    $offset,
    $encrypted_ticket_length,
);
my $world_ticket = decrypt_ticket($encrypted_ticket);

$selected_server_id == $server_id
    or die "Le serveur Auth a sélectionné le monde $selected_server_id au lieu de $server_id.\n";
length($world_ticket) == 33 && unpack('C', substr($world_ticket, 0, 1)) == 32
    or die "Le ticket de monde déchiffré est invalide.\n";

close($socket);
$socket = IO::Socket::INET->new(
    PeerAddr => $world_host,
    PeerPort => $world_ports[0],
    Proto    => 'tcp',
    Timeout  => 5,
) or die "Connexion impossible au monde $world_host:$world_ports[0] : $!\n";
$socket->autoflush(1);
$selector = IO::Select->new($socket);

my ($hello_game_id) = read_frame();
$hello_game_id == 708
    or die "Handshake monde inattendu : message $hello_game_id au lieu de HelloGameMessage (708).\n";

print $socket pack_frame(6808, pack_utf('fr') . pack_utf($world_ticket))
    or die "Impossible d'envoyer AuthenticationTicketMessage : $!\n";

my %world_received;
my $world_deadline = time() + 10;
while (time() < $world_deadline && !$world_received{7505}) {
    my ($message_id) = read_frame();
    $world_received{$message_id} = 1;
    $message_id == 5922 and die "Le monde a refusé le ticket d'authentification.\n";
}
$world_received{7505}
    or die "AuthenticationTicketAcceptedMessage (7505) non reçu. Messages : "
        . join(', ', sort { $a <=> $b } keys %world_received) . "\n";

print $socket pack_frame(2412, '')
    or die "Impossible d'envoyer CharactersListRequestMessage : $!\n";

my $character_count;
my $characters_deadline = time() + 10;
while (time() < $characters_deadline && !defined($character_count)) {
    my ($message_id, $payload) = read_frame();
    next if $message_id != 8016;
    length($payload) >= 2 or die "CharactersListMessage tronqué.\n";
    $character_count = unpack('n', substr($payload, 0, 2));
}
defined($character_count)
    or die "CharactersListMessage (8016) non reçu.\n";

print "Smoke test réussi : protocole $server_protocol, authentification $username, "
    . "monde $server_id, $character_count personnage(s).\n";

# Optional full character/catalogue check. Use a disposable staging character.
if (defined $ENV{GINY_TEST_CHARACTER_ID}) {
    print $socket pack_frame(6792, pack_varint($ENV{GINY_TEST_CHARACTER_ID}));
    my $loaded = 0;
    my $hud;
    while (!$loaded) {
        my ($id, $payload) = read_frame();
        if ($id == 16380) { my $next = modern_json($payload); $hud = $next if !$next->{unchanged} && !$next->{error}; }
        $id == 1596 and die "Sélection du personnage refusée.\n";
        $loaded = $id == 605;
    }
    print $socket pack_frame(16381, '');
    my $hud_reply = 0;
    while (!$hud_reply) {
        my ($id, $payload) = read_frame();
        next if $id != 16380;
        my $size = unpack('n', substr($payload, 0, 2));
        my $start = 2;
        if ($size == 65535) { $size = unpack('N', substr($payload, 2, 4)); $start = 6; }
        my $next = decode_json(substr($payload, $start, $size));
        $hud = $next if !$next->{unchanged};
        $hud_reply = 1;
    }
    $hud && $hud->{character} or die "Aucun HUD complet reçu pendant la sélection.\n";
    !exists($hud->{error}) or die "HUD refusé : $hud->{error}\n";
    if ($ENV{GINY_TEST_EXPECT_ITEM_GID}) {
        $hud->{character}{id} == $ENV{GINY_TEST_CHARACTER_ID} or die "HUD complet absent à la reconnexion.\n";
        my ($restored) = grep { $_->{gid} == $ENV{GINY_TEST_EXPECT_ITEM_GID} } @{$hud->{items} // []};
        $restored && $restored->{position} == 63 or die "Équipement restauré absent à la reconnexion.\n";
        print "Reconnexion : HUD complet et équipement restauré vérifiés.\n";
    }
    if (defined $ENV{GINY_TEST_CATALOG_VERSION}) {
        ($hud->{catalog_version} // '') eq $ENV{GINY_TEST_CATALOG_VERSION}
            or die "Version du catalogue serveur inattendue.\n";
    }
    print $socket pack_frame(5527, '');
    my $map;
    while (!defined $map) {
        my ($id, $payload) = read_frame();
        next if $id != 7991;
        $map = unpack('d>', substr($payload, 0, 8));
    }
    print $socket pack_frame(2408, pack('d>', $map));
    my $map_loaded = 0;
    while (!$map_loaded) { my ($id) = read_frame(); $map_loaded = $id == 9792; }
    print "Personnage chargé, HUD et catalogue vérifiés, carte $map reçue.\n";
    if ($ENV{GINY_TEST_HUD_RECONCILIATION}) {
        my $unchanged = 0;
        for (1..3) {
            print $socket pack_frame(16381, '');
            while (1) {
                my ($id, $payload) = read_frame();
                next if $id != 16380;
                my $snapshot = modern_json($payload);
                exists($snapshot->{error}) and die "Réconciliation HUD refusée.\n";
                $unchanged++ if $snapshot->{unchanged};
                last;
            }
        }
        $unchanged >= 1 or die "Aucune réponse HUD unchanged au repos.\n";
        print "Réconciliation HUD : $unchanged réponses légères validées.\n";
    }
    if ($ENV{GINY_TEST_HUD_EQUIPMENT}) {
        $port != 8443 or die "Utiliser une instance isolée pour le test équipement.\n";
        if ($ENV{GINY_TEST_EQUIPMENT_GID}) {
            print $socket pack_frame(3932, pack_utf('.item ' . $ENV{GINY_TEST_EQUIPMENT_GID} . ' 1') . pack('C', 0));
            print $socket pack_frame(16381, '');
            while (1) {
                my ($id, $payload) = read_frame();
                next if $id != 16380;
                my $next = modern_json($payload);
                next if $next->{unchanged} || !$next->{items};
                $hud = $next;
                last if grep { $_->{gid} == $ENV{GINY_TEST_EQUIPMENT_GID} } @{$hud->{items}};
            }
        }
        my ($item) = grep { $_->{equipped} && @{$_->{equip_positions} // []} } @{$hud->{items} // []};
        if (!$item) {
            ($item) = grep { @{$_->{equip_positions} // []} && $_->{criteria_ok} && $_->{level} <= $hud->{character}{level} } @{$hud->{items} // []};
        }
        if ($ENV{GINY_TEST_EQUIPMENT_GID}) {
            ($item) = grep { $_->{gid} == $ENV{GINY_TEST_EQUIPMENT_GID} } @{$hud->{items} // []};
        }
        $item or die "Fixture sans équipement utilisable pour le test HUD.\n";
        my $original = $item->{position};
        my @positions = ($original == 63 ? $item->{equip_positions}[0] : 63, $original);
        my $step = 0;
        for my $position (@positions) {
            my $request_id = sprintf('a0000000-0000-4000-8000-%012d', ++$step);
            my $command = {schemaVersion => 1, requestId => $request_id, characterId => "$ENV{GINY_TEST_CHARACTER_ID}", action => 'item.equip', args => {uid => $item->{uid}, position => $position}};
            print $socket pack_frame(16378, pack_utf(encode_json($command)));
            while (1) {
                my ($id, $payload) = read_frame();
                if ($id == 16380) { my $next = modern_json($payload); $hud = $next if !$next->{unchanged} && !$next->{error}; }
                next if $id != 16377;
                my $result = modern_json($payload);
                next if $result->{requestId} ne $request_id;
                $result->{success} or die "Action équipement refusée : " . encode_json($result) . "\n";
                last;
            }
            my ($updated) = grep { $_->{uid} == $item->{uid} } @{$hud->{items}};
            $updated && $updated->{position} == $position or die "Push HUD équipement manquant.\n";
        }
        print "Équipement : modification et restauration confirmées par push HUD avant la réponse de commande.\n";
    }
    if ($ENV{GINY_TEST_PORTAL_ELEMENT}) {
        $port != 8443 or die "Utiliser une instance isolée pour le test de porte.\n";
        my $element = $ENV{GINY_TEST_PORTAL_ELEMENT};
        my $destination = $ENV{GINY_TEST_PORTAL_DESTINATION};
        print $socket pack_frame(3932, pack_utf(".sun $element $destination 0") . pack('C', 0));
        print $socket pack_frame(16383, '');
        while (1) {
            my ($id, $payload) = read_frame(); next if $id != 16382;
            my $snapshot = modern_json($payload);
            my ($door) = grep { $_->{element_id} == $element && $_->{action} eq 'Teleport' } @{$snapshot->{interactives} // []};
            $door or die "Porte de fixture non créée.\n";
            last;
        }
        print $socket pack_frame(1424, pack_varint($element) . pack_varint(0));
        my $used = 0;
        while (1) {
            my ($id, $payload) = read_frame();
            $id == 2991 and die "Utilisation de la porte refusée.\n";
            $used = 1 if $id == 3900;
            next if $id != 7991;
            unpack('d>', substr($payload, 0, 8)) == $destination or die "Destination de porte incorrecte.\n";
            $used or die "Événement InteractiveUsed absent.\n";
            last;
        }
        print $socket pack_frame(2408, pack('d>', $destination));
        while (1) { my ($id) = read_frame(); last if $id == 9792; }
        print $socket pack_frame(16381, '');
        while (1) {
            my ($id, $payload) = read_frame(); next if $id != 16380;
            my $next = modern_json($payload);
            $hud = $next if !$next->{unchanged};
            $hud->{map}{id} == $destination or die "HUD resté sur la map précédente après porte.\n";
            last;
        }
        print "Porte : InteractiveUse, CurrentMap et HUD de destination validés.\n";
    }
    if (defined $ENV{GINY_TEST_MONSTER_ID}) {
        $port != 8443 or die "Le test de combat modifie un personnage : utiliser une instance de validation.\n";
        print $socket pack_frame(3932, pack_utf('.monsters ' . $ENV{GINY_TEST_MONSTER_ID} . ' 0') . pack('C', 0));
        print $socket pack_frame(16383, '');
        my $world;
        while (!defined $world) { my ($id, $payload) = read_frame(); $world = modern_json($payload) if $id == 16382; }
        my @groups = grep { $_->{group} && grep { $_->{id} == $ENV{GINY_TEST_MONSTER_ID} } @{$_->{group}{members}} } @{$world->{actors}};
        @groups or die "Groupe de validation absent de la carte.\n";
        print $socket pack_frame(9329, pack('d>', $groups[0]{id}));
        my $fight;
        while (!defined $fight) {
            my ($id, $payload) = read_frame();
            next if $id != 16379;
            my $event = modern_json($payload);
            $fight = $event->{snapshot} if $event->{snapshot} && @{$event->{snapshot}{fighters}} >= 2;
        }
        ($fight->{catalog_version} // '') eq ($hud->{catalog_version} // '') or die "Version combat/HUD différente.\n";
        for my $fighter (@{$fight->{fighters}}) {
            my $stats = $fighter->{preview_stats};
            ref($stats) eq 'ARRAY' && @$stats or die "Statistiques de prévision absentes du snapshot de combat.\n";
            my @initiative = grep { $_->{id} == 44 && defined $_->{total} } @$stats;
            @initiative == 1 or die "Initiative absente ou dupliquée dans le snapshot de combat.\n";
        }
        my @monsters = grep { $_->{id} != $ENV{GINY_TEST_CHARACTER_ID} } @{$fight->{fighters}};
        $monsters[0]{life} > 0 && $monsters[0]{ap} > 0 or die "Stats du monstre invalides.\n";
        print "Combat créé : $monsters[0]{name}, niveau $monsters[0]{level}, PV $monsters[0]{life}, PA $monsters[0]{ap}, PM $monsters[0]{mp}.\n";
        print $socket pack_frame(4314, '');
    }

}

sub modern_json {
    my ($payload) = @_;
    my $size = unpack('n', substr($payload, 0, 2));
    my $start = 2;
    if ($size == 65535) { $size = unpack('N', substr($payload, 2, 4)); $start = 6; }
    return decode_json(substr($payload, $start, $size));
}
