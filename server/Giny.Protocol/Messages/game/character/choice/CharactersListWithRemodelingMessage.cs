using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class CharactersListWithRemodelingMessage : CharactersListMessage
    {
        public new const ushort Id = 9633;
        public override ushort MessageId => Id;

        public CharacterToRemodelInformations[] charactersToRemodel;

        public CharactersListWithRemodelingMessage()
        {
        }
        public CharactersListWithRemodelingMessage(CharacterToRemodelInformations[] charactersToRemodel, CharacterBaseInformations[] characters)
        {
            this.charactersToRemodel = charactersToRemodel;
            this.characters = characters;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            writer.WriteShort((short)charactersToRemodel.Length);
            for (uint _i1 = 0; _i1 < charactersToRemodel.Length; _i1++)
            {
                (charactersToRemodel[_i1] as CharacterToRemodelInformations).Serialize(writer);
            }

        }
        public override void Deserialize(IDataReader reader)
        {
            CharacterToRemodelInformations _item1 = null;
            base.Deserialize(reader);
            uint _charactersToRemodelLen = (uint)(reader.ReadUShort());
            charactersToRemodel = new CharacterToRemodelInformations[_charactersToRemodelLen];
            for (uint _i1 = 0; _i1 < _charactersToRemodelLen; _i1++)
            {
                _item1 = new CharacterToRemodelInformations();
                _item1.Deserialize(reader);
                charactersToRemodel[_i1] = _item1;
            }

        }

    }
}


