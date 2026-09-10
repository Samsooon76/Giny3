using Giny.Core.DesignPattern;
using Giny.Core;
using Giny.Core.Network.Messages;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Enums;
using Giny.Protocol.Messages;
using Giny.Protocol.Types;
using Giny.World.Handlers.Roleplay.Maps.Paths;
using Giny.World.Managers.Dialogs.DialogBox;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Fights;
using Giny.World.Managers.Maps;
using Giny.World.Managers.Monsters;
using Giny.World.Network;
using Giny.World.Records;
using Giny.World.Records.Maps;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Handlers.Maps
{
    class MapsHandler
    {
        [Annotation("check areaId")]
        [MessageHandler]
        public static void HandleFriendJoinRequestMessage(FriendJoinRequestMessage message, WorldClient client)
        {

            var target = WorldServer.Instance.GetClient(message.target);

            if (target == null)
            {
                return;
            }

            if (target.Character.Map.Subarea.AreaId != 45 || client.Character.Map.Subarea.AreaId != 45)
            {
                client.Character.TextInformation(TextInformationTypeEnum.TEXT_INFORMATION_MESSAGE, 493);
                return;
            }
            client.Character.Teleport(target.Character.Record.MapId, target.Character.Map.Instance.GetNearEntityCell(target.Character.GetCell()));
        }
        [MessageHandler]
        public static void HandleGameMapChangeOrientation(GameMapChangeOrientationRequestMessage message, WorldClient client) => client.Character.SetDirection((DirectionsEnum)message.direction);
        [MessageHandler]
        public static void HandleEmotePlayRequestMessage(EmotePlayRequestMessage message, WorldClient client)
        {
            if (!client.Character.Fighting && !client.Character.Collecting)
                client.Character.PlayEmote(message.emoteId);
        }
        [MessageHandler]
        public static void HandleMapInformationsRequestMessage(MapInformationsRequestMessage message, WorldClient client)
        {
            if (client.Character.Fighting)
            {
                var fightMap = client.Character.Fighter.Fight.Map;
                if (fightMap.Id == message.mapId) fightMap.Instance.SendMapComplementary(client);
                return;
            }
            if (client.Character.Record.MapId == message.mapId)
            {
                SubareaRecord? oldSubarea = null;

                if (client.Character.Map != null)
                {
                    oldSubarea = client.Character.Map.Subarea;
                }

                client.Character.Map = MapRecord.GetMap((int)message.mapId);

                if (oldSubarea != client.Character.Map.Subarea)
                {
                    client.Character.OnSubareaChange(oldSubarea, client.Character.Map.Subarea);
                }

                if (client.Character.Map == null)
                {
                    client.Character.SpawnPoint();
                    client.Character.Reply("Unknown Map...(" + message.mapId + ")");
                    return;
                }

                client.Character.OnEnterMap();
                client.Character.NoMove();

            }
        }

        [MessageHandler]
        public static void HandleGameMapMovementRequestMessage(GameMapMovementRequestMessage message, WorldClient client)
        {
            if (client.Character.Fighting)
            {
                if (client.Character.Fighter.Fight.StartAcknowledged)
                {
                    List<short> path = PathReader.FightMove(PathReader.ReturnDispatchedCells(message.keyMovements)).Keys.ToList();

                    IEnumerable<CellRecord> cells = path.Select(x => client.Character.Fighter.Fight.Map.GetCell(x));
                    client.Character.Fighter.Move(cells.ToList());
                }
            }
            else
            {
                if (client.Character.ChangeMap)
                {
                    Logger.Write($"[Movement] Mouvement refusé pour '{client.Character.Name}': changement de carte en cours (ChangeMap=true).", Channels.Warning);
                    client.Character.NoMove();
                }
                else if (client.Character.Map.Id != message.mapId)
                {
                    Logger.Write($"[Movement] Mouvement refusé pour '{client.Character.Name}': mapId incorrect (client={message.mapId}, serveur={client.Character.Map.Id}).", Channels.Warning);
                    client.Character.NoMove();
                }
                else
                {
                    client.Character.MoveOnMap(message.keyMovements);
                }
            }
        }

        [MessageHandler]
        public static void HandleMapMovementConfirm(GameMapMovementConfirmMessage message, WorldClient client)
        {
            if (client.Character.IsMoving)
            {
                client.Character.EndMove();
                client.Send(new BasicNoOperationMessage());
            }
        }
        [MessageHandler]
        public static void HandleMapMovementCancel(GameMapMovementCancelMessage message, WorldClient client)
        {
            client.Character.CancelMove(message.cellId);
        }
        [MessageHandler]
        public static void HandleGameRolePlayAttackMonsterRequest(GameRolePlayAttackMonsterRequestMessage message, WorldClient client)
        {
            if (client.Character.Map != null)
            {
                MonsterGroup group = client.Character.Map.Instance.GetEntity<MonsterGroup>((long)message.monsterGroupId);

                if (group != null && client.Character.CellId == group.CellId)
                {
                    group.Agress(client.Character);
                }
                else
                {
                    client.Character.NoMove();
                }
            }
        }
        [MessageHandler]
        public static void HandleGameRolePlayPlayerFightFriendlyAnswer(GameRolePlayPlayerFightFriendlyAnswerMessage message, WorldClient client)
        {
            if (client.Character.IsInRequest() && client.Character.HasRequestBoxOpen<DualRequest>())
            {
                if (message.accept)
                {
                    client.Character.RequestBox.Accept();
                }
                else
                {
                    if (client.Character == client.Character.RequestBox.Target)
                    {
                        client.Character.RequestBox.Deny();
                    }
                    else
                    {
                        client.Character.RequestBox.Cancel();
                    }
                }
            }
        }
        [MessageHandler]
        public static void HandleGameRolePlayPlayerFightRequest(GameRolePlayPlayerFightRequestMessage message, WorldClient client)
        {
            Character target = client.Character.Map.Instance.GetEntity<Character>(message.targetId);

            if (target != null)
            {
                if (message.friendly)
                {
                    FighterRefusedReasonEnum fighterRefusedReasonEnum = client.Character.CanRequestFight(target);

                    if (fighterRefusedReasonEnum != FighterRefusedReasonEnum.FIGHTER_ACCEPTED)
                    {
                        client.Send(new ChallengeFightJoinRefusedMessage(client.Character.Id, (byte)fighterRefusedReasonEnum));
                    }
                    else
                    {
                        target.OpenRequestBox(new DualRequest(client.Character, target));
                    }
                }
            }
        }
        [MessageHandler]
        public static void HandleChangeMap(ChangeMapMessage message, WorldClient client)
        {
            MapScrollEnum scrollType = MapScrollEnum.UNDEFINED;
            if (client.Character.Map.LeftMap == message.mapId)
                scrollType = MapScrollEnum.LEFT;
            if (client.Character.Map.RightMap == message.mapId)
                scrollType = MapScrollEnum.RIGHT;
            if (client.Character.Map.BottomMap == message.mapId)
                scrollType = MapScrollEnum.BOTTOM;
            if (client.Character.Map.TopMap == message.mapId)
                scrollType = MapScrollEnum.TOP;

            if (scrollType != MapScrollEnum.UNDEFINED)
            {
                int teleportMapId = MapsManager.Instance.GetNeighbourMapId(client.Character.Map, scrollType);

                MapRecord teleportedMap = MapRecord.GetMap(teleportMapId);

                if (teleportedMap != null)
                {
                    short? destinationCellId = MapsManager.Instance.FindMapChangeCell(
                        teleportedMap, scrollType, client.Character.Record.CellId);
                    if (!destinationCellId.HasValue)
                    {
                        client.Character.ReplyError("Aucune cellule d'arrivée praticable sur cette carte.");
                        return;
                    }

                    client.Character.Record.Direction = MapsManager.Instance.GetScrollDirection(scrollType);
                    client.Character.Teleport(teleportMapId, destinationCellId.Value);
                }
                else
                {
                    client.Character.ReplyError("Unknown map.");
                }
            }
            else
            {
                client.Character.ReplyError("Unknown map transition.");
            }
        }
    }
}
