using Giny.Core.Time;
using Giny.Protocol.Types;
using Giny.Protocol.Custom.Enums;
using Giny.World.Managers.Entities.Look;
using Giny.World.Managers.Fights;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Records.Maps;
using Giny.World.Records.Monsters;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Managers.Monsters
{
    public class Monster
    {
        public CellRecord RoleplayCell
        {
            get;
            private set;
        }
        public MonsterGrade Grade
        {
            get;
            set;
        }
        public MonsterRecord Record
        {
            get;
            set;
        }
        public ServerEntityLook Look
        {
            get
            {
                return this.Record.Look;
            }
        }

        /// <summary>
        /// Status is attached to this concrete monster instance, never inferred
        /// from its species. It therefore survives group display and fight creation.
        /// </summary>
        public PokefusStatusEnum PokefusStatus
        {
            get;
            private set;
        } = PokefusStatusEnum.NONE;

        public bool IsPokefus => PokefusStatus != PokefusStatusEnum.NONE;

        public bool IsLegendaryPokefus => PokefusStatus == PokefusStatusEnum.POKEFUS_LEGENDARY;

        public void SetPokefusStatus(PokefusStatusEnum status)
        {
            PokefusStatus = status;
        }
        public byte GradeId
        {
            get
            {
                return Grade.GradeId;
            }
        }
        public Monster(MonsterRecord template, CellRecord roleplayCell, byte gradeId)
        {
            this.Record = template;
            this.RoleplayCell = roleplayCell;
            this.Grade = template.GetGrade(gradeId);
        }
        public Monster(MonsterRecord template, CellRecord roleplayCell)
        {
            this.Record = template;
            this.RoleplayCell = roleplayCell;
            this.Grade = template.RandomGrade();
        }

        public MonsterInGroupInformations GetMonsterInGroupInformations()
        {
            return new MonsterInGroupInformations()
            {
                genericId = (int)Record.Id,
                grade = GradeId,
                level = Grade.Level,
                pokefusStatus = (byte)PokefusStatus,
                look = Look.ToEntityLook(),
            };
        }
        public MonsterInGroupLightInformations GetMonsterInGroupLightInformations()
        {
            return new MonsterInGroupLightInformations()
            {
                genericId = (int)Record.Id,
                grade = GradeId,
                level = Grade.Level,
                pokefusStatus = (byte)PokefusStatus,
            };
        }
        public override string ToString()
        {
            return string.Format("{0} ({1})", this.Record.Name, this.Record.Id);
        }
        public Fighter CreateFighter(FightTeam team)
        {
            return new MonsterFighter(team, RoleplayCell, this);
        }
    }
}
