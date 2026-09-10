using Giny.ORM;
using Giny.Protocol.Custom.Enums;
using Giny.Pokefus.Data;
using Giny.Pokefus.Data.Records;
using Giny.Pokefus.Effects;
using Giny.World.Managers.Chat;
using Giny.World.Network;
using Giny.World.Records.Items;
using Giny.World.Records.Monsters;
using System.Linq;

namespace Giny.Pokefus
{
    class ChatCommands
    {
        [ChatCommand("reloadpokefus", ServerRoleEnum.Administrator)]
        public static void ReloadPokefusCommand(WorldClient client)
        {
            PokefusWishManager.Initialize();
            PokefusDataManager.Initialize();
            DatabaseManager.Instance.Reload<PokefusCaptureConfigurationRecord>();
            DatabaseManager.Instance.Reload<PokefusCaptureNetRecord>();
            client.Character.ReplyWarning("Pokefus reloaded.");
        }

        /// <summary>Give 50 nets of every configured bracket.</summary>
        [ChatCommand("filet", ServerRoleEnum.Player)]
        public static void GiveCaptureNetsCommand(WorldClient client)
        {
            var nets = PokefusCaptureNetRecord.GetNets().Where(x => x.Enabled).ToList();
            if (nets.Count == 0)
            {
                client.Character.ReplyWarning("Aucun filet n'est configuré.");
                return;
            }

            foreach (var net in nets)
            {
                client.Character.Inventory.AddItem(net.ItemGid, 50);
            }

            client.Character.Reply($"<b>{nets.Count}</b> piles de 50 filets Pokéfus ajoutées.");
        }

        [ChatCommand("pokefus", ServerRoleEnum.GamemasterPadawan)]
        public static void PokefusCommand(WorldClient client, short monsterId)
        {
            MonsterRecord monsterRecord = MonsterRecord.GetMonsterRecord(monsterId);
            // Wish templates use SIDEKICK (169) — prefer Common rarity sign for real pokefus items
            var template = ItemRecord.GetItem(27582) ?? ItemRecord.GetItem(2469);
            CharacterItemRecord item = PokefusManager.Instance.CreatePokefusItem(client.Character.Id, template, monsterRecord, 1);
            client.Character.Inventory.AddItem(item);
            PokefusGenomeService.Instance.EnsureInstance(client.Character, item);
            client.Character.Reply("Pokefus " + monsterRecord.Name + " added (UID " + item.UId + ").");
        }

        /// <summary>
        /// Give every pokéfus from pokefus.json (all wish pools + static).
        /// Usage: .pokefusall
        /// </summary>
        [ChatCommand("pokefusall", ServerRoleEnum.GamemasterPadawan)]
        public static void PokefusAllCommand(WorldClient client)
        {
            var monsters = PokefusWishManager.GetAllWishMonsters().ToList();
            if (monsters.Count == 0)
            {
                client.Character.ReplyWarning("Aucun monstre dans pokefus.json (ou module non chargé).");
                return;
            }

            int added = 0;
            int skipped = 0;

            foreach (var monster in monsters)
            {
                try
                {
                    double rate = PokefusWishManager.GetRateForMonster(monster);
                    var rarity = PokefusWishManager.GetRarityForMonster(monster, rate);
                    var template = PokefusWishManager.GetTemplateForRarity(rarity)
                        ?? ItemRecord.GetItem(27582)
                        ?? ItemRecord.GetItem(2469);

                    if (template == null || monster.Grades == null || monster.Grades.Count == 0)
                    {
                        skipped++;
                        continue;
                    }

                    byte gradeId = monster.Grades.First().GradeId;
                    CharacterItemRecord item = PokefusManager.Instance.CreatePokefusItem(
                        client.Character.Id, template, monster, gradeId);
                    client.Character.Inventory.AddItem(item);
                    PokefusGenomeService.Instance.EnsureInstance(client.Character, item);
                    added++;
                }
                catch
                {
                    skipped++;
                }
            }

            client.Character.Reply(
                $"<b>Pokéfus all</b> : {added} ajouté(s)" +
                (skipped > 0 ? $", {skipped} ignoré(s)" : "") +
                $" (total pools : {monsters.Count}).");
        }

        /// <summary>Show active team (player command).</summary>
        [ChatCommand("pteam", ServerRoleEnum.Player)]
        public static void PokefusTeamCommand(WorldClient client)
        {
            PokefusManager.Instance.ReplyTeamStatus(client.Character);
        }

        /// <summary>
        /// Toggle Pokéfus capture mode. A later UI button should call
        /// <see cref="PokefusManager.SetCaptureMode"/> instead of this command.
        /// Usage: .capture on | .capture off
        /// </summary>
        [ChatCommand("capture", ServerRoleEnum.Player)]
        public static void CaptureModeCommand(WorldClient client, string mode)
        {
            if (string.Equals(mode, "on", StringComparison.OrdinalIgnoreCase))
            {
                PokefusManager.Instance.SetCaptureMode(client.Character, true);
                return;
            }

            if (string.Equals(mode, "off", StringComparison.OrdinalIgnoreCase))
            {
                PokefusManager.Instance.SetCaptureMode(client.Character, false);
                return;
            }

            client.Character.ReplyWarning("Usage : .capture on | .capture off");
        }

        /// <summary>Add pokéfus to team by inventory object UID.</summary>
        [ChatCommand("padd", ServerRoleEnum.Player)]
        public static void PokefusAddCommand(WorldClient client, int objectUid)
        {
            PokefusManager.Instance.ActivatePokefus(client.Character, objectUid);
        }

        /// <summary>Remove pokéfus from team by inventory object UID.</summary>
        [ChatCommand("prem", ServerRoleEnum.Player)]
        public static void PokefusRemoveCommand(WorldClient client, int objectUid)
        {
            PokefusManager.Instance.DeactivatePokefus(client.Character, objectUid);
        }

        /// <summary>List all pokéfus in inventory (not only active).</summary>
        [ChatCommand("plist", ServerRoleEnum.Player)]
        public static void PokefusListCommand(WorldClient client)
        {
            var items = client.Character.Inventory.GetItems()
                .Where(x => PokefusManager.Instance.IsPokefusItem(x))
                .ToList();

            client.Character.Reply($"<b>Collection Pokéfus</b> : {items.Count} — équipe {PokefusManager.Instance.GetActivePokefusCount(client.Character)}/{PokefusManager.MaxActivePokefus}");

            foreach (var item in items)
            {
                var pf = item.Effects.GetFirst<EffectPokefus>();
                var lvl = item.Effects.GetFirst<EffectPokefusLevel>();
                bool active = item.IsEquiped() && PokefusManager.IsPokefusPosition(item.PositionEnum);
                string flag = active ? "<font color='#00ff00'>[ACTIF]</font>" : "[réserve]";
                client.Character.Reply($"  {flag} {pf.MonsterName} niv.{lvl.Level} — UID <b>{item.UId}</b>");
            }
        }

        /// <summary>Returns the complete server-authoritative state to the patched client UI.</summary>
        [ChatCommand("pstate", ServerRoleEnum.Player)]
        public static void PokefusStateCommand(WorldClient client)
        {
            PokefusGenomeService.Instance.SendState(client.Character);
        }

        [ChatCommand("presearch", ServerRoleEnum.Player)]
        public static void PokefusResearchCommand(WorldClient client, long geneId)
        {
            OperationResult result = PokefusGenomeService.Instance.ResearchGene(client.Character, geneId);
            client.Character.Reply(result.Message);
            PokefusGenomeService.Instance.SendState(client.Character, result);
        }

        [ChatCommand("punlock", ServerRoleEnum.Player)]
        public static void PokefusUnlockCommand(WorldClient client, long pokefusId, long geneId)
        {
            OperationResult result = PokefusGenomeService.Instance.UnlockGene(client.Character, pokefusId, geneId);
            client.Character.Reply(result.Message);
            PokefusGenomeService.Instance.SendState(client.Character, result);
        }

        [ChatCommand("pequipgene", ServerRoleEnum.Player)]
        public static void PokefusEquipGeneCommand(WorldClient client, long pokefusId, long geneId, byte slot)
        {
            OperationResult result = PokefusGenomeService.Instance.EquipGene(client.Character, pokefusId, geneId, slot);
            client.Character.Reply(result.Message);
            PokefusGenomeService.Instance.SendState(client.Character, result);
        }

        [ChatCommand("punequipgene", ServerRoleEnum.Player)]
        public static void PokefusUnequipGeneCommand(WorldClient client, long pokefusId, byte slot)
        {
            OperationResult result = PokefusGenomeService.Instance.UnequipGene(client.Character, pokefusId, slot);
            client.Character.Reply(result.Message);
            PokefusGenomeService.Instance.SendState(client.Character, result);
        }
    }
}
