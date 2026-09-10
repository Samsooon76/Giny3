using System;using Giny.Core.IO;using Giny.Core.Network.Messages;
class Program { static void Main() {
 // Client.OnDataArrival constructs the reader over all 8192 bytes, even when only 9 arrived.
 var buffer=new byte[8192];buffer[0]=0;buffer[1]=5;buffer[5]=1;buffer[6]=4;buffer[7]=0xAA;buffer[8]=0xBB;
 var part=new MessagePart();using var reader=new BigEndianReader(buffer);
 Console.WriteLine("ReceivedBytes=9, DeclaredPayloadBytes=4, ActualPayloadBytes=2");
 Console.WriteLine("BuildAcceptedIncomplete="+part.Build(reader)+", ReaderPosition="+reader.Position+", Payload="+BitConverter.ToString(part.Data));
 }}