using Giny.Core;
using Giny.Core.Network;
using Giny.Core.Network.Messages;
using Giny.Protocol.IPC.Types;
using Giny.Protocol.Messages;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using Giny.Protocol.Enums;
using System.Text;
using System.Threading.Tasks;
using Giny.Core.Extensions;
using Giny.Protocol.Custom.Enums;
using Giny.World.Managers.Breeds;
using Giny.World.Records;
using Giny.Protocol.Types;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Records.Characters;
using Giny.World.Records.Accounts;
using Giny.ORM;
using Giny.World.Managers.Items;
using Giny.World.Records.Items;
using Giny.World.Managers.Items.Collections;
using Giny.Core.DesignPattern;
using Giny.World.Logging;
using Giny.Core.IO.Configuration;
using Giny.World.Managers.Modern;

namespace Giny.World.Network
{
    public class WorldClient : Client
    {
        public bool ModernClientEnabled { get; set; }
        private string lastCharacterSnapshot;
        private readonly ModernSnapshotCache characterSnapshotCache = new();
        private long characterSnapshotRevision;
        public void SendCharacterSnapshot(Func<string> build, bool force)
        {
            lock (modernSendLock)
            {
                SendCharacterSnapshot(characterSnapshotCache.Read(Character, characterSnapshotRevision,
                    build, force, Environment.TickCount64));
            }
        }
        public void SendCharacterSnapshot(string json)
        {
            lock (modernSendLock)
            {
                var unchanged = string.Equals(lastCharacterSnapshot, json, StringComparison.Ordinal);
                Send(new ModernCharacterSnapshotMessage(unchanged ? "{\"unchanged\":true}" : json));
                lastCharacterSnapshot = json;
            }
        }

        private long modernCombatRevision;
        private readonly object modernSendLock = new();

        public override void Send(NetworkMessage message)
        {
            lock (modernSendLock)
            {
                // Conservatively invalidate on legacy notifications, including inventory,
                // stats, guild and context changes. Projection replies are not mutations.
                if (message is not ModernCharacterSnapshotMessage && message is not ModernMapSnapshotMessage && message is not ModernFightSnapshotMessage)
                    characterSnapshotRevision++;
                if (ModernClientEnabled && ModernCombatEvents.IsCombatMessage(message) &&
                    (Character?.Fighting == true || message is GameContextDestroyMessage or GameContextCreateMessage or GameContextRemoveElementMessage or GameContextRemoveMultipleElementsMessage))
                {
                    try
                    {
                        base.Send(new ModernFightSnapshotMessage(ModernCombatEvents.BuildJson(this, message, ++modernCombatRevision)));
                    }
                    catch (Exception ex) { Logger.Write($"Combat projection: {ex}", Channels.Warning); }
                }
                base.Send(message);
            }
        }

        /// <summary>Sends a modern-only combat event (sequence children) without
        /// touching the legacy wire. Legacy clients never see it.</summary>
        public void SendModernCombatEvent(string name, object? data)
        {
            lock (modernSendLock)
            {
                if (!ModernClientEnabled || Character?.Fighting != true)
                    return;
                try
                {
                    base.Send(new ModernFightSnapshotMessage(ModernCombatEvents.BuildSyntheticJson(this, name, data, ++modernCombatRevision)));
                }
                catch (Exception ex) { Logger.Write($"Combat projection: {ex}", Channels.Warning); }
            }
        }

        public Account Account
        {
            get;
            set;
        }
        public WorldAccountRecord WorldAccount
        {
            get;
            set;
        }

        public List<CharacterRecord> Characters
        {
            get;
            private set;
        }
        public bool InGame
        {
            get
            {
                return CharacterSelected && Character.Record.InGameContext;
            }
        }

        public bool CharacterSelected => Character != null;

        public Character Character
        {
            get;
            set;
        }

        public WorldClient(Socket socket) : base(socket)
        {
            base.Send(new HelloGameMessage());

        }
        public WorldClient()
        {

        }

        public override void OnConnected()
        {
            throw new NotImplementedException();
        }

        public override void OnConnectionClosed()
        {
            try
            {
                OnDisconnected();
            }
            catch (Exception ex)
            {
                Logger.Write("Unable to disconnect World Client : " + ex, Channels.Warning);
            }
        }

        public override void OnFailToConnect(Exception ex)
        {
            throw new NotImplementedException();
        }
        public override void OnMessageReceived(NetworkMessage message)
        {
            if (ConfigManager<WorldConfig>.Instance.LogProtocol)
                Logger.Write("(World) Received " + message, Channels.Info);

            ProtocolMessageManager.HandleMessage(message, this);
        }

        public override void OnSended(IAsyncResult result)
        {
            if (ConfigManager<WorldConfig>.Instance.LogProtocol)
                Logger.Write("(World) Send " + result.AsyncState);
        }

        public override void OnMessageUnhandled(NetworkMessage message)
        {
            if (message is UnknownMessage)
            {
                if (ConfigManager<WorldConfig>.Instance.LogProtocol)
                    Logger.Write(string.Format("Ignored unknown message id {0}", message.MessageId), Channels.Warning);
                return;
            }

            if (ConfigManager<WorldConfig>.Instance.LogProtocol)
                Logger.Write(string.Format("No Handler: ({0}) {1}", message.MessageId, message.ToString()), Channels.Warning);

        }

        public override void OnHandlingError(NetworkMessage message, Delegate handler, Exception ex)
        {
            Logger.Write(string.Format("Unable to handle message {0} {1} : '{2}'", message.ToString(), handler.Method.Name, ex.ToString()), Channels.Warning);
            LogManager.Instance.AppendError(this, message, ex);
        }

        public void SendCharactersList()
        {
            CharacterBaseInformations[] characters = new CharacterBaseInformations[Characters.Count];

            for (int i = 0; i < Characters.Count; i++)
            {
                characters[i] = Characters[i].GetCharacterBaseInformations(true);
            }

            Send(new CharactersListMessage(characters));
        }

        public override void OnDisconnected()
        {
            WorldServer.Instance.RemoveClient(this);
            Dispose();
        }

        private void Dispose()
        {
            Character?.OnDisconnected();
            if (Account != null) ServerCharacterPreviews.Publish(Account.Id);
        }
        private void LoadWorldAccount()
        {
            this.WorldAccount = WorldAccountRecord.GetWorldAccount(this.Account.Id);

            if (this.WorldAccount == null)
            {
                this.WorldAccount = WorldAccountRecord.Create(this.Account.Id);
                this.WorldAccount.AddLater();
            }
        }
        [Annotation]
        public void OnAccountReceived()
        {
            Send(new AccountInformationsUpdateMessage(DateTime.Now.AddYears(3).GetUnixTimeStampDouble()));

            LoadWorldAccount();
            SendBasicTime();
            Characters = CharacterRecord.GetCharactersByAccountId(Account.Id);

            Send(new ServerSettingsMessage("fr", 0, (byte)WorldServer.Instance.GetServerType(), false, 1, 200, true));

            SendServerOptionalFeatures(OptionalFeaturesEnum.PVP_KIS, OptionalFeaturesEnum.CHARACTER_XP);

            Send(new ServerSessionConstantsMessage(new ServerSessionConstant[]
           {
               new ServerSessionConstantInteger()
               {
                   id = (short)ServerConstantTypeEnum.KOH_DURATION,
                   value = 7200000,
               },
               new ServerSessionConstantInteger()
               {
                   id = (short)ServerConstantTypeEnum.UNKOWN_6,
                   value = 10,
               },
                new ServerSessionConstantInteger()
               {
                   id = (short)ServerConstantTypeEnum.UNKNOW_7,
                   value = 2000,
               }
           }));

            // Client 2.73 needs breed bitmasks (bit breedId-1) or the creation UI stays empty.
            int breedFlags = GetAllowedBreedFlags();
            Send(new AccountCapabilitiesMessage(Account.Id, true, breedFlags, breedFlags, 0, true));

            Send(new TrustStatusMessage(true));

            if (Characters.Any(x => x.InGameContext))
            {
                this.Disconnect();
            }
            // client.Send(new HaapiSessionMessage());
        }

        public CharacterRecord GetCharacter(long characterId)
        {
            return Characters.FirstOrDefault(x => x.Id == characterId);
        }

        public void SendServerOptionalFeatures(params OptionalFeaturesEnum[] optionalFeaturesEnum)
        {
            Send(new ServerOptionalFeaturesMessage(optionalFeaturesEnum.Select(x => (int)x).ToArray()));
        }

        public void SendBasicTime()
        {
            var offset = (short)TimeZone.CurrentTimeZone.GetUtcOffset(DateTime.Now).TotalMinutes;
            Send(new BasicTimeMessage(DateTime.Now.GetUnixTimeStampLong(), offset));
        }

        private static int GetAllowedBreedFlags()
        {
            int flags = 0;
            foreach (var breed in ConfigManager<WorldConfig>.Instance.AllowedBreeds)
            {
                int breedId = (int)breed;
                if (breedId <= 0)
                {
                    continue;
                }

                flags |= 1 << (breedId - 1);
            }

            return flags;
        }


    }
}
