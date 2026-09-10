using Giny.Core.Network.Messages;
using Giny.Protocol.Enums;
using Giny.Protocol.Messages;
using Giny.World.Managers.Fights;
using Giny.World.Network;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Giny.World.Handlers
{
    class ContextHandler
    {
        [MessageHandler]
        public static void HandleGameContextCreateRequestMessage(GameContextCreateRequestMessage message, WorldClient client)
        {
            if (client.Character == null)
            {
                return;
            }

            client.Character.Record.InGameContext = true;

            if (client.Character.Record.IsInFight && FightManager.Instance.GetConnectedFighter(client.Character) != null)
            {
                client.Character.DestroyContext();
                client.Character.CreateContext(GameContextEnum.FIGHT);
                client.Character.ReconnectToFight();

            }
            else
            {
                client.Character.Record.FightId = null;
                client.Character.CreateContext(GameContextEnum.ROLE_PLAY);
                client.Character.Teleport(client.Character.Record.MapId, client.Character.Record.CellId);
                client.Character.RefreshStats();
            }
        }
        [MessageHandler]
        public static void HandleGameContextReadyMessage(GameContextReadyMessage message, WorldClient client)
        {
            client.Character?.OnGameContextReady(message.mapId);
        }
    }
}
