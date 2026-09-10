using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Giny.Auth.Network;
using Giny.Auth.Records;
using Giny.Core;
using Giny.Core.Network.Messages;
using Giny.Protocol.Custom;
using Giny.Protocol.IPC.Messages;
using Giny.Protocol.Messages;
namespace Giny.Auth.Handlers
{
    internal static class ServerCharacterPreviews
    {
        private static readonly Dictionary<string, ServerCharacterPreview[]> Cache = new Dictionary<string, ServerCharacterPreview[]>();
        private static readonly object Sync = new object();
        private static readonly string DirectoryPath = Path.Combine(AppContext.BaseDirectory, "data", "server-character-previews");
        private static string FilePath(short serverId, int accountId) => Path.Combine(DirectoryPath, $"{serverId}-{accountId}.json");

        [MessageHandler]
        public static void Receive(IPCServerCharactersMessage message, Giny.Auth.Network.IPC.IPCClient client)
        {
            if (client.WorldServerRecord == null) return;
            var previews = JsonSerializer.Deserialize<ServerCharacterPreview[]>(message.json) ?? Array.Empty<ServerCharacterPreview>();
            lock (Sync)
            {
                Cache[FilePath(client.WorldServerRecord.Id, message.accountId)] = previews;
                try
                {
                    Directory.CreateDirectory(DirectoryPath);
                    var path = FilePath(client.WorldServerRecord.Id, message.accountId);
                    File.WriteAllText(path + ".tmp", JsonSerializer.Serialize(previews));
                    File.Move(path + ".tmp", path, true);
                }
                catch (Exception error) when (error is IOException || error is UnauthorizedAccessException) { Logger.Write("Cannot persist server character previews: " + error.Message, Channels.Warning); }
            }
            var accountClient = AuthServer.Instance.GetClient(message.accountId);
            if (accountClient?.ServerCharactersEnabled == true) Send(accountClient);
        }

        [MessageHandler]
        public static void Request(ModernServerCharactersRequestMessage message, AuthClient client)
        {
            if (client.Account == null) return;
            client.ServerCharactersEnabled = true;
            Send(client);
        }

        private static ServerCharacterPreview[] Read(short serverId, int accountId, long[] ids)
        {
            lock (Sync)
            {
                try
                {
                    var path = FilePath(serverId, accountId);
                    if (Cache.TryGetValue(path, out var cached)) return cached.Where(character => ids.Contains(character.id)).ToArray();
                    if (!File.Exists(path)) return Array.Empty<ServerCharacterPreview>();
                    return (JsonSerializer.Deserialize<ServerCharacterPreview[]>(File.ReadAllText(path)) ?? Array.Empty<ServerCharacterPreview>())
                        .Where(character => ids.Contains(character.id)).ToArray();
                }
                catch (Exception error) when (error is IOException || error is JsonException || error is UnauthorizedAccessException) { return Array.Empty<ServerCharacterPreview>(); }
            }
        }
        private static void Send(AuthClient client)
        {
            // The request carries no account id: only the authenticated account's records may be read.
            var servers = WorldCharacterRecord.Get(client.Account.Id).GroupBy(character => character.ServerId)
                .Select(group => new { id = group.Key, characters = Read(group.Key, client.Account.Id, group.Select(character => character.CharacterId).ToArray()) }).ToArray();
            client.Send(new ModernServerCharactersMessage(JsonSerializer.Serialize(new { servers })));
        }
    }
}
