using Giny.Core;
using Giny.Core.Extensions;
using Giny.Core.IO;
using Giny.Core.IO.Interfaces;
using Giny.Core.Network;
using Giny.Core.Network.IPC;
using Giny.Core.Network.Messages;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace Giny.Core.Network.Messages
{
    public class ProtocolMessageManager
    {
        private static readonly Type[] HandlerMethodParameterTypes = new Type[] { typeof(NetworkMessage), typeof(Client) };

        private static readonly Dictionary<uint, Action<object, NetworkMessage, Client>> Handlers = new Dictionary<uint, Action<object, NetworkMessage, Client>>();

        private static readonly Dictionary<ushort, Type> Messages = new Dictionary<ushort, Type>();

        private static readonly Dictionary<ushort, Func<NetworkMessage>> Constructors = new Dictionary<ushort, Func<NetworkMessage>>();

        public static void Initialize(Assembly messagesAssembly, Assembly handlersAssembly)
        {
            List<int> duplicateIds = new List<int>();

            foreach (var type in messagesAssembly.GetTypes().Where(x => x.IsSubclassOf(typeof(NetworkMessage))))
            {
                FieldInfo field = type.GetField("Id");
                if (field != null)
                {
                    ushort num = (ushort)field.GetValue(type);
                    if (Messages.ContainsKey(num))
                    {
                        duplicateIds.Add(num);
                        continue;
                        // throw new AmbiguousMatchException(string.Format("MessageReceiver() => {0} item is already in the dictionary, old type is : {1}, new type is  {2}",
                        //    num, Messages[num], type));
                    }
                    Messages.Add(num, type);
                    ConstructorInfo constructor = type.GetConstructor(Type.EmptyTypes);
                    if (constructor == null)
                    {
                        throw new Exception(string.Format("'{0}' doesn't implemented a parameterless constructor", type));
                    }
                    Constructors.Add(num, constructor.CreateDelegate<Func<NetworkMessage>>());
                }
            }

            if (duplicateIds.Count > 0)
            {
                foreach (var id in duplicateIds)
                {
                    Logger.Write("Duplicate message id " + id, Channels.Critical);
                }

                for (ushort i = 0; i < 100; i++)
                {
                    if (!Messages.ContainsKey(i))
                    {
                        Logger.Write("FreeId : " + i);
                    }
                }


                Console.ReadLine();
                Environment.Exit(0);
            }


            foreach (var item in handlersAssembly.GetTypes())
            {
                foreach (var subItem in item.GetMethods())
                {
                    var attribute = subItem.GetCustomAttribute(typeof(MessageHandlerAttribute));
                    if (attribute != null)
                    {
                        Type methodParameters = subItem.GetParameters()[0].ParameterType;
                        if (methodParameters.BaseType != null)
                        {
                            try
                            {
                                Delegate target = subItem.CreateDelegate(HandlerMethodParameterTypes);
                                FieldInfo field = methodParameters.GetField("Id");
                                Handlers.Add((ushort)field.GetValue(null), (Action<object, NetworkMessage, Client>)target);
                            }
                            catch (Exception ex)
                            {
                                throw new Exception("Cannot register " + subItem.Name + " has message handler..." + ex);
                            }

                        }
                    }

                }
            }
            Logger.Write(Messages.Count + " message(s) loaded | " + Handlers.Count + " handler(s) loaded", Channels.Log);
        }
        /// <summary>
        /// Care about reader position!
        /// </summary>
        /// <summary>
        /// Tries to read one full frame from <paramref name="reader"/>.
        /// Returns null when the buffer does not yet contain a complete frame (caller must wait).
        /// Unknown protocol ids still consume the frame and return <see cref="UnknownMessage"/>
        /// so the receive loop can advance without kicking the client.
        /// </summary>
        public static NetworkMessage BuildMessage(BigEndianReader reader, bool isIpc = false)
        {
            var messagePart = new MessagePart();

            if (!messagePart.Build(reader, hasSequence: !isIpc, trailerLength: isIpc ? 3 : 0))
            {
                // Incomplete frame — keep buffered bytes, wait for more TCP data.
                return null;
            }

            try
            {
                ushort messageId = (ushort)messagePart.MessageId.Value;

                if (!Messages.ContainsKey(messageId))
                {
                    Logger.Write(
                        $"Unknown message id {messageId} (payload length {messagePart.Length ?? 0}), ignored.",
                        Channels.Warning);
                    return new UnknownMessage(messageId);
                }

                NetworkMessage message = Constructors[messageId]();

                if (message == null)
                {
                    Logger.Write("Unable to construct message id " + messageId, Channels.Warning);
                    return new UnknownMessage(messageId);
                }

                using var finalReader = new BigEndianReader(messagePart.Data);
                message.Unpack(finalReader);
                return message;
            }
            catch (Exception ex)
            {
                Logger.Write("Unable to build message : " + ex, Channels.Warning);
                // Frame was fully read from the stream; skip it rather than desync/kick.
                return new UnknownMessage((ushort)(messagePart.MessageId ?? 0));
            }
        }
        public static ushort[] GetMessageIds()
        {
            return Messages.Keys.ToArray();
        }
        private static bool IsIPCMessage(NetworkMessage message)
        {
            return message is IPCMessage;
        }
        public static bool HandleMessage(NetworkMessage message, Client client)
        {
            if (message == null)
            {
                Logger.Write("Cannot build datas from client " + client.Ip, Channels.Warning);
                client.Disconnect();
                return false;
            }

            Handlers.TryGetValue(message.MessageId, out var handler);

            if (handler != null)
            {
                {
                    try
                    {
                        handler(null, message, client);
                        return true;

                    }
                    catch (Exception ex)
                    {
                        client.OnHandlingError(message, handler, ex);
                        return false;
                    }
                }
            }
            else
            {
                client.OnMessageUnhandled(message);
                return true;
            }
        }
    }

}
