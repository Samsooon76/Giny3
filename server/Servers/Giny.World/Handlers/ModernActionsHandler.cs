using System.Runtime.CompilerServices;
using System.Text.Json;
using Giny.Core;
using Giny.Core.Network.Messages;
using Giny.ORM;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Enums;
using Giny.Protocol.Messages;
using Giny.World.Handlers.Items;
using Giny.World.Handlers.Roleplay.Spells;
using Giny.World.Handlers.Roleplay.Stats;
using Giny.World.Managers.Items;
using Giny.World.Managers.Modern;
using Giny.World.Network;

namespace Giny.World.Handlers
{
    internal static class ModernActionsHandler
    {
        private sealed class Session
        {
            public readonly Dictionary<string, (string Request, string Result)> Results = new();
        }
        private static readonly ConditionalWeakTable<WorldClient, Session> Sessions = new();

        [MessageHandler]
        public static void HandleModernActionRequestMessage(ModernActionRequestMessage message, WorldClient client)
        {
            ModernActionRequest request;
            try { request = ModernActionRequest.Parse(message.actionJson); }
            catch (Exception) { return; } // Malformed envelopes have no trustworthy correlation ID.
            var session = Sessions.GetOrCreateValue(client);
            lock (session)
            {
                var character = client.Character;
                if (character == null || character.Id != request.CharacterId)
                {
                    SendResult(client, request, false, "wrong_character", "Cette commande ne correspond pas au personnage connecté.");
                    return;
                }
                if (session.Results.TryGetValue(request.RequestId, out var previous))
                {
                    if (previous.Request == message.actionJson)
                    {
                        ModernCharacterSnapshot.Send(client);
                        if (ModernNpcInteractions.Handles(request.Action)) ModernNpcInteractions.Send(client);
                        client.Send(new ModernActionResultMessage(previous.Result));
                    }
                    else SendResult(client, request, false, "request_conflict", "Identifiant de commande déjà utilisé.");
                    return;
                }
                bool success = false;
                string code = "", detail = "";
                try
                {
                    if (!ModernNpcInteractions.Handles(request.Action) && (character.Busy || character.Fighting)) throw new ArgumentException("Action indisponible pendant un combat ou une interaction.");
                    Execute(request, client);
                    character.Record.UpdateLater();
                    success = true;
                }
                catch (ArgumentException ex) { code = "refused"; detail = ex.Message; }
                catch (Exception ex)
                {
                    code = "unknown_result";
                    detail = "Le résultat de l’action n’a pas pu être confirmé. Les données sont resynchronisées.";
                    Logger.Write($"Modern action {request.Action}: {ex}", Channels.Warning);
                }
                var result = Result(request, success, code, detail);
                if (session.Results.Count >= 128) session.Results.Remove(session.Results.Keys.First());
                session.Results.Add(request.RequestId, (message.actionJson, result));
                ModernCharacterSnapshot.Send(client);
                if (ModernNpcInteractions.Handles(request.Action)) ModernNpcInteractions.Send(client);
                client.Send(new ModernActionResultMessage(result));
            }
        }

        private static string Result(ModernActionRequest request, bool success, string errorCode, string message) =>
            JsonSerializer.Serialize(new { schemaVersion = 1, requestId = request.RequestId,
                characterId = request.CharacterId.ToString(), success, errorCode, message });

        private static void SendResult(WorldClient client, ModernActionRequest request, bool success, string code, string detail) =>
            client.Send(new ModernActionResultMessage(Result(request, success, code, detail)));

        private static void Execute(ModernActionRequest request, WorldClient client)
        {
            var character = client.Character;
            if (ModernNpcInteractions.Handles(request.Action)) { ModernNpcInteractions.Execute(request, client); return; }
            switch (request.Action)
            {
                case "item.equip":
                case "item.use":
                {
                    int uid = request.Int("uid", 1, int.MaxValue);
                    var item = character.Inventory.GetItem(uid) ?? throw new ArgumentException("Cet objet n’est plus dans votre inventaire.");
                    string before = ModernCharacterSnapshot.BuildJson(client);
                    if (request.Action == "item.equip")
                    {
                        int position = request.Int("position", 0, 63);
                        if (item.Position == position) return;
                        if (position != 63 && !ModernEquipmentRules.Positions(item.Record).Contains(position))
                            throw new ArgumentException("Cet objet ne peut pas être équipé à cet emplacement.");
                        InventoryHandler.HandleObjectSetPositionMessage(new ObjectSetPositionMessage(uid, (byte)position, 1), client);
                    }
                    else
                    {
                        if (!item.Record.Usable) throw new ArgumentException("Cet objet ne peut pas être utilisé directement.");
                        character.UseItem(uid, true);
                    }
                    if (before == ModernCharacterSnapshot.BuildJson(client))
                        throw new ArgumentException("Giny a refusé l’action ou aucun changement n’était possible.");
                    break;
                }
                case "stats.boost":
                {
                    int stat = request.Int("statId", 10, 15);
                    int amount = request.Int("amount", 1, short.MaxValue);
                    var points = character.Stats[CharacteristicEnum.STATS_POINTS];
                    int previous = points.Total();
                    StatsHandler.HandleStatsUpgradeRequestMessage(new StatsUpgradeRequestMessage(false, (byte)stat, (short)amount), client);
                    if (points.Total() == previous) throw new ArgumentException("Points insuffisants pour cette augmentation.");
                    break;
                }
                case "stats.reset": character.Restat(); break;
                case "spell.activate":
                {
                    short id = (short)request.Int("spellId", 1, short.MaxValue);
                    if (character.GetSpell(id) != null) return;
                    var owned = character.GetSpellByVariant(id);
                    if (owned?.VariantSpellRecord == null || owned.VariantSpellRecord.MinimumLevel > character.Level)
                        throw new ArgumentException("Ce sort n’est pas disponible pour votre personnage.");
                    SpellsHandler.HandleSpellVariantActivationRequestMessage(new SpellVariantActivationRequestMessage(id), client);
                    if (character.GetSpell(id) == null) throw new ArgumentException("Le changement de variante a été refusé.");
                    break;
                }
                case "title.select":
                    if (character.Record.ActiveTitleId == request.Int("id", 0, short.MaxValue)) return;
                    if (!character.ActiveTitle((short)request.Int("id", 0, short.MaxValue))) throw new ArgumentException("Titre non débloqué.");
                    break;
                case "ornament.select":
                    if (!character.ActiveOrnament((short)request.Int("id", 0, short.MaxValue))) throw new ArgumentException("Ornement non débloqué.");
                    break;
                default:
                    if (!ModernModuleActions.Execute(request, character)) throw new ArgumentException("Action non prise en charge.");
                    break;
            }
        }
    }
}
