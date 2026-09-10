using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Enums;
using Giny.Protocol.Messages;
using Giny.Protocol.Types;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Entities.Npcs;
using Giny.World.Records.Items;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Managers.Exchanges
{
    public class BuySellExchange : Exchange
    {
        public override ExchangeTypeEnum ExchangeType
        {
            get
            {
                return ExchangeTypeEnum.NPC_SHOP;
            }
        }

        public Npc Npc
        {
            get;
            set;
        }

        public ItemRecord[] ItemToSell
        {
            get;
            set;
        }

        public short TokenId
        {
            get;
            set;
        }

        public BuySellExchange(Character character, Npc npc, ItemRecord[] itemToSell, short tokenId)
            : base(character)
        {
            this.Npc = npc;
            this.ItemToSell = itemToSell;
            this.TokenId = tokenId;
        }

        public override void Open()
        {
            ObjectItemToSellInNpcShop[] items = Array.ConvertAll<ItemRecord, ObjectItemToSellInNpcShop>(ItemToSell, x => x.GetObjectItemToSellInNpcShop());
            Character.Client.Send(new ExchangeStartOkNpcShopMessage(Npc.Id, TokenId, items));
        }

        public bool Buy(short gid, int quantity)
        {
            if (!ReferenceEquals(Character.Dialog, this)) return false;
            var template = ItemToSell.FirstOrDefault(x => x.Id == gid);
            if (template == null || !Giny.World.Managers.Modern.NpcTransactionRules.TryPrice(template.Price, quantity, false, out int cost)) return false;
            if (TokenId == 0)
            {
                if (!Character.RemoveKamas(cost)) return false;
            }
            else
            {
                var tokens = Character.Inventory.GetItems().Where(i => i.GId == TokenId && !i.IsEquiped()).ToArray();
                if (tokens.Sum(i => (long)i.Quantity) < cost) return false;
                int remaining = cost;
                foreach (var token in tokens) {
                    int debit = Math.Min(remaining, token.Quantity);
                    if (debit > 0) Character.Inventory.RemoveItem(token.UId, debit);
                    remaining -= debit;
                    if (remaining == 0) break;
                }
            }
            Character.Inventory.AddItem(gid, quantity, TokenId != 0);
            Character.Client.Send(new ExchangeBuyOkMessage());
            return true;
        }
        public bool Sell(int uid, int quantity)
        {
            if (!ReferenceEquals(Character.Dialog, this)) return false;
            var item = Character.Inventory.GetItem(uid);
            if (item == null || item.IsEquiped() || !item.CanBeExchanged() || item.Quantity < quantity ||
                !Giny.World.Managers.Modern.NpcTransactionRules.TryPrice(item.Record.Price, quantity, true, out int gained)) return false;
            Character.Inventory.RemoveItem(uid, quantity);
            if (TokenId == 0) Character.AddKamas(gained);
            else Character.Inventory.AddItem(TokenId, gained);
            Character.Client.Send(new ExchangeSellOkMessage());
            return true;
        }
        public override void MoveItem(int uid, int quantity)
        {
            throw new NotImplementedException();
        }

        public override void Ready(bool ready, short step)
        {
            throw new NotImplementedException();
        }

        public override void MoveKamas(long quantity)
        {
            throw new NotImplementedException();
        }

        public override void OnNpcGenericAction(NpcActionsEnum action)
        {
            
        }

        public override void MoveItemPriced(int objectUID, int quantity, long price)
        {
            throw new NotImplementedException();
        }

        public override void ModifyItemPriced(int objectUID, int quantity, long price)
        {
            throw new NotImplementedException();
        }
    }
}
