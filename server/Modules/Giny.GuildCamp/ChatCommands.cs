using Giny.Protocol.Custom.Enums;
using Giny.World.Managers.Chat;
using Giny.World.Network;

namespace Giny.GuildCamp
{
    internal static class ChatCommands
    {
        [ChatCommand("gcampstate", ServerRoleEnum.Player)]
        public static void State(WorldClient client)
        {
            GuildCampService.Instance.SendState(client.Character);
        }

        [ChatCommand("gcampk", ServerRoleEnum.Player)]
        public static void ContributeKamas(WorldClient client, long buildingId, long amount)
        {
            CampOperationResult result = GuildCampService.Instance.ContributeKamas(client.Character, buildingId, amount);
            client.Character.Reply(result.Message);
            GuildCampService.Instance.SendState(client.Character, result);
        }

        [ChatCommand("gcampresource", ServerRoleEnum.Player)]
        public static void ContributeResource(WorldClient client, long buildingId, int itemId, int quantity)
        {
            CampOperationResult result = GuildCampService.Instance.ContributeResource(client.Character, buildingId, itemId, quantity);
            client.Character.Reply(result.Message);
            GuildCampService.Instance.SendState(client.Character, result);
        }

        [ChatCommand("gcampupgrade", ServerRoleEnum.Player)]
        public static void CompleteUpgrade(WorldClient client, long buildingId)
        {
            CampOperationResult result = GuildCampService.Instance.CompleteUpgrade(client.Character, buildingId);
            client.Character.Reply(result.Message);
            if (!result.Success)
            {
                GuildCampService.Instance.SendState(client.Character, result);
            }
        }

        [ChatCommand("reloadguildcamp", ServerRoleEnum.Administrator)]
        public static void Reload(WorldClient client)
        {
            client.Character.ReplyWarning("Le campement est piloté par la BDD ; redémarrez World après une modification de configuration.");
        }
    }
}
