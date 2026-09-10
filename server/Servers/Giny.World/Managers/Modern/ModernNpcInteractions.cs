using System.Runtime.CompilerServices;
using System.Text.Json;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Messages;
using Giny.World.Managers.Criterias;
using Giny.World.Managers.Dialogs;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Entities.Npcs;
using Giny.World.Managers.Exchanges;
using Giny.World.Managers.Exchanges.Trades;
using Giny.World.Network;
using Giny.World.Records.Items;

namespace Giny.World.Managers.Modern;

/// <summary>Authoritative, recipient-specific PNJ state on the existing modern module stream.</summary>
public static class ModernNpcInteractions
{
    public static readonly string[] Capabilities = { "npc.sync", "npc.action", "npc.reply", "npc.buy", "npc.sell", "npc.move", "npc.ready", "npc.leave" };
    private sealed class Session { public Dialog? Dialog; public string Id = ""; public int Revision; }
    private static readonly ConditionalWeakTable<Character, Session> Sessions = new();
    public static bool Handles(string action) => Capabilities.Contains(action);
    public static bool IsNpcDialog(Dialog? dialog) => dialog is NpcTalkDialog or BuySellExchange or NpcTradeExchange;
    public static int[] Actions(Npc npc, Character character) => npc.SpawnRecord.Actions
        .Where(a => a.Action is NpcActionsEnum.TALK or NpcActionsEnum.BUYSELL or NpcActionsEnum.EXCHANGE)
        .Where(a => CriteriaExpression.Eval(a.Criteria, character.Client)).Select(a => (int)a.Action).Distinct().ToArray();
    public static object ProjectActor(Npc npc, Character character) => new { template_id = npc.Template.Id, actions = Actions(npc, character) };

    private static object Item(CharacterItemRecord item) => new { uid = item.UId, gid = (int)item.GId, name = item.Record.Name, quantity = item.Quantity };
    public static void Send(WorldClient client)
    {
        if (!client.ModernClientEnabled || client.Character == null) return;
        var c = client.Character;
        var session = Sessions.GetOrCreateValue(c);
        var dialog = IsNpcDialog(c.Dialog) ? c.Dialog : null;
        if (!ReferenceEquals(session.Dialog, dialog)) { session.Dialog = dialog; session.Id = Guid.NewGuid().ToString(); }
        session.Revision++;
        object? state = null;
        if (dialog != null)
        {
            var npc = dialog switch { NpcTalkDialog talk => talk.Npc, BuySellExchange shop => shop.Npc, NpcTradeExchange trade => trade.Npc, _ => throw new InvalidOperationException() };
            var shopDialog = dialog as BuySellExchange;
            state = new {
                sessionId = session.Id, revision = session.Revision, mapId = c.Map.Id,
                actorId = npc.Id, templateId = npc.Template.Id, name = npc.Name,
                kind = dialog is NpcTalkDialog ? "talk" : dialog is BuySellExchange ? "shop" : "trade",
                messageId = (dialog as NpcTalkDialog)?.MessageId ?? 0,
                dialogParams = new[] { "0" }, replies = (dialog as NpcTalkDialog)?.VisibleReplies ?? Array.Empty<int>(),
                tokenId = (int)(shopDialog?.TokenId ?? 0), kamas = c.Record.Kamas,
                currencyBalance = shopDialog?.TokenId > 0 ? c.Inventory.GetItems().Where(i => i.GId == shopDialog.TokenId && !i.IsEquiped()).Sum(i => (long)i.Quantity) : c.Record.Kamas,
                offers = shopDialog?.ItemToSell.Select(i => new { gid = i.Id, name = i.Name, price = i.Price }).ToArray(),
                inventory = c.Inventory.GetItems().Where(i => !i.IsEquiped() && i.CanBeExchanged()).Select(i => new {
                    uid = i.UId, gid = (int)i.GId, name = i.Record.Name, quantity = i.Quantity,
                    sellPrice = Math.Max(1, (int)(i.Record.Price / 10)), basePrice = i.Record.Price
                }).ToArray(),
                local = (dialog as NpcTradeExchange)?.GetItems().Where(i => i.CharacterId != -1).Select(Item).ToArray(),
                remote = (dialog as NpcTradeExchange)?.GetItems().Where(i => i.CharacterId == -1).Select(Item).ToArray(),
                acceptedGids = (dialog as NpcTradeExchange)?.AcceptedGids ?? Array.Empty<int>()
            };
        }
        client.Send(new ModernModuleStateMessage(JsonSerializer.Serialize(new { schemaVersion = 1, module = "npc", characterId = c.Id.ToString(), revision = session.Revision, state })));
    }

    public static void Execute(ModernActionRequest request, WorldClient client)
    {
        var c = client.Character;
        if (request.Action == "npc.sync") return;
        if (c.Fighting) throw new ArgumentException("Interaction indisponible pendant un combat.");
        if (request.Action == "npc.action")
        {
            if (c.Busy) throw new ArgumentException("Terminez l’interaction en cours.");
            if (request.Int("mapId", 1, int.MaxValue) != c.Map.Id) throw new ArgumentException("Le PNJ n’est plus sur cette carte.");
            var npc = c.Map.Instance.GetEntity<Npc>(request.Int("actorId", int.MinValue, int.MaxValue)) ?? throw new ArgumentException("PNJ introuvable.");
            int action = request.Int("actionId", 1, 3);
            if (!Actions(npc, c).Contains(action)) throw new ArgumentException("Cette action n’est pas disponible.");
            npc.InteractWith(c, (NpcActionsEnum)action);
            if (!IsNpcDialog(c.Dialog)) throw new ArgumentException("Ce PNJ ne peut pas ouvrir cette interaction.");
            return;
        }
        var session = Sessions.GetOrCreateValue(c);
        if (!IsNpcDialog(c.Dialog) || !ReferenceEquals(c.Dialog, session.Dialog) ||
            !request.Args.TryGetProperty("sessionId", out var id) || id.ValueKind != JsonValueKind.String || id.GetString() != session.Id ||
            request.Int("revision", 1, int.MaxValue) != session.Revision)
            throw new ArgumentException("L’interaction a changé. Vérifiez les données actualisées.");
        switch (request.Action)
        {
            case "npc.leave": c.Dialog.Close(); break;
            case "npc.reply" when c.Dialog is NpcTalkDialog talk:
                int reply = request.Int("replyId", 1, int.MaxValue);
                if (!talk.VisibleReplies.Contains(reply)) throw new ArgumentException("Cette réponse n’est plus disponible.");
                talk.Reply(reply); break;
            case "npc.buy" when c.Dialog is BuySellExchange shop:
                if (!shop.Buy((short)request.Int("gid", 1, short.MaxValue), request.Int("quantity", 1, int.MaxValue)))
                    throw new ArgumentException("Achat refusé : vérifiez la quantité et votre monnaie.");
                break;
            case "npc.sell" when c.Dialog is BuySellExchange shop:
                if (!shop.Sell(request.Int("uid", 1, int.MaxValue), request.Int("quantity", 1, int.MaxValue)))
                    throw new ArgumentException("Vente refusée : vérifiez l’objet et sa quantité.");
                break;
            case "npc.move" when c.Dialog is NpcTradeExchange trade:
                int uid = request.Int("uid", 1, int.MaxValue), quantity = request.Int("quantity", -int.MaxValue, int.MaxValue);
                if (!trade.CanMove(uid, quantity)) throw new ArgumentException("Cet objet ou cette quantité ne peut pas être échangé.");
                trade.MoveItem(uid, quantity); break;
            case "npc.ready" when c.Dialog is NpcTradeExchange trade:
                if (!trade.CanComplete()) throw new ArgumentException("L’offre est vide ou les objets ne sont plus disponibles.");
                trade.Ready(true, 0); break;
            default: throw new ArgumentException("Action incompatible avec cette interaction.");
        }
    }
}
