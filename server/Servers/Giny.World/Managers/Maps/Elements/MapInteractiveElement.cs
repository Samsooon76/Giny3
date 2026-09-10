using Giny.Protocol.Messages;
using Giny.Protocol.Types;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Maps.Instances;
using Giny.World.Records.Maps;

namespace Giny.World.Managers.Maps.Elements
{
    public class MapInteractiveElement : MapElement
    {
        public MapInteractiveElement(MapInstance mapInstance, InteractiveElementRecord record) : base(record, mapInstance)
        {

        }

        protected InteractiveElementSkill[] GetInteractiveElementSkill()
        {
            return new InteractiveElementSkill[]
            {
                new InteractiveElementSkill((int)Record.Skill.SkillId, 0)
            };
        }

        public void Update()
        {
            foreach (var character in MapInstance.GetEntities<Character>())
            {
                character.Client.Send(new InteractiveElementUpdatedMessage(GetInteractiveElement(character)));
            }
        }
        protected virtual bool IsSkillEnabled(Character character, SkillRecord record)
        {
            return record != null && character.SkillsAllowed.Contains(record);
        }

        /// <summary>
        /// Le personnage a-t-il le metier et le niveau requis pour cet element ?
        /// Projection utilisee par le snapshot du client moderne.
        /// </summary>
        public bool IsEnabledFor(Character character)
        {
            return IsSkillEnabled(character, Record.Skill?.Record);
        }
        public InteractiveElement GetInteractiveElement(Character character)
        {
            InteractiveElementSkill[] skills = GetInteractiveElementSkill();

            if (IsSkillEnabled(character, Record.Skill?.Record))
            {
                return new InteractiveElement((int)Record.Identifier, (int)Record.Skill.Type, skills, new InteractiveElementSkill[0], true);
            }
            else
            {
                return new InteractiveElement((int)Record.Identifier, (int)Record.Skill.Type, new InteractiveElementSkill[0], skills, true);
            }
        }
    }
}
