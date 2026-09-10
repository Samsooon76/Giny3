using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.Serialization;
using Giny.Core.Network.Messages;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Messages;
using Giny.Protocol.Types;
using Giny.World.Managers.Entities;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Entities.Look;
using Giny.World.Managers.Maps.Instances;
using Giny.World.Network;
using Xunit;

namespace Giny.World.Tests;

public class ActorBroadcastTests
{
    private sealed class Client : WorldClient
    {
        public readonly List<NetworkMessage> Received = new();
        public override void Send(NetworkMessage message) => Received.Add(message);
    }
    private sealed class Actor : Entity
    {
        public readonly Dictionary<Character, GameRolePlayActorInformations> Views = new();
        public Actor() : base(null) { }
        public override long Id => 100;
        public override string Name => "fixture";
        public override short CellId { get; set; }
        public override DirectionsEnum Direction { get; set; }
        public override ServerEntityLook Look { get; set; } = null!;
        public override GameRolePlayActorInformations GetActorInformations(Character target)
            => Views[target] = new GameRolePlayActorInformations();
    }

    [Fact]
    public void UnchangedHudUsesALightweightReplyAndChangedHudIsSentInFull()
    {
        using var client = new Client();
        client.SendCharacterSnapshot("{\"value\":1}");
        client.SendCharacterSnapshot("{\"value\":1}");
        client.SendCharacterSnapshot("{\"value\":2}");
        Assert.Equal("{\"value\":1}", Assert.IsType<ModernCharacterSnapshotMessage>(client.Received[0]).snapshotJson);
        Assert.Equal("{\"unchanged\":true}", Assert.IsType<ModernCharacterSnapshotMessage>(client.Received[1]).snapshotJson);
        Assert.Equal("{\"value\":2}", Assert.IsType<ModernCharacterSnapshotMessage>(client.Received[2]).snapshotJson);
    }

    [Fact]
    public void AppearanceSendsOnePersonalizedMessagePerRecipient()
    {
        var map = (ClassicMapInstance)FormatterServices.GetUninitializedObject(typeof(ClassicMapInstance));
        var entities = new ConcurrentDictionary<long, Entity>();
        typeof(MapInstance).GetField("m_entities", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(map, entities);
        var clients = new List<Client>();
        try
        {
            for (int i = 0; i < 20; i++)
            {
                var client = new Client(); clients.Add(client);
                var character = (Character)FormatterServices.GetUninitializedObject(typeof(Character));
                typeof(Character).GetProperty(nameof(Character.Client))!.SetValue(character, client);
                entities[i] = character;
            }
            var actor = new Actor();
            typeof(MapInstance).GetMethod("ShowActor", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(map, new object[] { actor });
            foreach (var pair in entities)
            {
                var character = (Character)pair.Value;
                var message = Assert.IsType<GameRolePlayShowActorMessage>(Assert.Single(((Client)character.Client).Received));
                Assert.Same(actor.Views[character], message.informations);
            }
        }
        finally { foreach (var client in clients) client.Dispose(); }
    }
}
