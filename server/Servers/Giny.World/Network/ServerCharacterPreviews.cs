using System.Linq;
using System.Text.Json;
using Giny.Protocol.Custom;
using Giny.Protocol.IPC.Messages;
using Giny.World.Managers.Entities.Look;
using Giny.World.Records.Characters;
namespace Giny.World.Network
{
    internal static class ServerCharacterPreviews
    {
        public static void Publish(int accountId)
        {
            if (!IPCManager.Instance.Connected) return;
            var previews = CharacterRecord.GetCharactersByAccountId(accountId).Select(character => new ServerCharacterPreview {
                id = character.Id, name = character.Name,
                look = EntityLookManager.Instance.ConvertToString(character.Look)
            }).ToArray();
            IPCManager.Instance.Send(new IPCServerCharactersMessage(accountId, JsonSerializer.Serialize(previews)));
        }
        public static void PublishAll()
        {
            foreach (var accountId in CharacterRecord.GetCharacterRecords().Select(character => character.AccountId).Distinct()) Publish(accountId);
        }
    }
}
