using Giny.Core.DesignPattern;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Records.Characters;
using Giny.World.Records.Maps;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Managers.Skills
{
    public class SkillsManager : Singleton<SkillsManager>
    {
        /* 3.5 secondes */
        public const short SKILL_DURATION = 35;

        public List<SkillRecord> GetAllowedSkills(Character character)
        {
            lock (this)
            {
                List<SkillRecord> results = new List<SkillRecord>();

                foreach (var skill in SkillRecord.GetSkills())
                {
                    if (skill.ParentJobId != 1)
                    {
                        /* Un personnage cree avant l'ajout d'un metier n'a pas la ligne correspondante. */
                        CharacterJob job = character.GetJob(skill.ParentJobId);

                        if (job != null && skill.MinLevel <= job.Level)
                            results.Add(skill);
                    }
                    else
                        results.Add(skill);

                }
                return results;
            }
        }
    }
}
