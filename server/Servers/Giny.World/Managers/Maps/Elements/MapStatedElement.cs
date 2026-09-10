using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Timers;
using Giny.Core.IO.Configuration;
using Giny.Core.Time;
using Giny.Protocol.Messages;
using Giny.Protocol.Types;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Formulas;
using Giny.World.Managers.Maps.Instances;
using Giny.World.Managers.Skills;
using Giny.World.Records.Characters;
using Giny.World.Records.Maps;
using Giny.World.Api;
using Timer = System.Timers.Timer;

namespace Giny.World.Managers.Maps.Elements
{
    public class MapStatedElement : MapInteractiveElement
    {
        /// <summary>
        /// Exprimé en secondes.
        /// </summary>
        public const int GrowInterval = 120;

        /// <summary>
        /// Représente le timer d'utilisation de l'élement.
        /// </summary>
        private Timer OnUsedCallback;

        /// <summary>
        /// Représente le timer de repousse de l'élement.
        /// </summary>
        private ActionTimer GrowCallback;

        /// <summary>
        /// BonesId de l'élement lié au skill.
        /// </summary>
        public int BonesId
        {
            get
            {
                return Record.BonesId;
            }
        }
        /// <summary>
        /// Personnage collecteur.
        /// </summary>
        private Character Character
        {
            get;
            set;
        }
        /// <summary>
        /// Skill utilisé.
        /// </summary>
        protected InteractiveSkillRecord Skill
        {
            get
            {
                return Record.Skill;
            }
        }
        /// <summary>
        /// Etat actuel de l'élement.
        /// </summary>
        private StatedElementState State
        {
            get;
            set;
        }

        /// <summary>
        /// Etat visible par le client (0 actif, 1 epuise, 2 en cours de recolte).
        /// </summary>
        public StatedElementState CurrentState => State;

        public MapStatedElement(MapInstance mapInstance, InteractiveElementRecord record) : base(mapInstance, record)
        {
        }
        public StatedElement GetStatedElement()
        {
            return new StatedElement()
            {
                elementCellId = Record.CellId,
                elementId = Record.Identifier,
                elementState = (int)State,
                onCurrentMap = true,
            };
        }
        /// <summary>
        /// Verrou d'element : deux joueurs qui cliquent la meme ressource dans la meme
        /// milliseconde ne doivent pas se voler le champ Character l'un a l'autre.
        /// </summary>
        private readonly object m_sync = new object();

        /// <summary>
        /// Le personnage a-t-il le niveau de metier requis ? Teste depuis CanUse, donc
        /// avant que le serveur n'annonce la recolte : le client recoit un refus net
        /// plutot qu'une animation qui ne se termine jamais.
        /// </summary>
        private bool HasRequiredJobLevel(Character character)
        {
            SkillRecord skill = Skill?.Record;

            if (skill == null)
            {
                return false;
            }

            CharacterJob job = character.GetJob(skill.ParentJobId);
            return job != null && job.Level >= skill.MinLevel;
        }

        public void Use(Character character)
        {
            lock (m_sync)
            {
                if (State != StatedElementState.Active || this.Character != null)
                {
                    return;
                }
                this.Character = character;
                this.GrowCallback = new ActionTimer(GrowInterval * 1000, Grow, false);
                OnUsedCallback = new Timer(SkillsManager.SKILL_DURATION * 100);
                OnUsedCallback.Elapsed += OnUsedCallback_Elapsed;
            }

            character.Collecting = true;
            this.UpdateState(StatedElementState.Used);
            OnUsedCallback.Start();
        }

        protected override bool IsSkillEnabled(Character character, SkillRecord record)
        {
            return base.IsSkillEnabled(character, record) && this.State != StatedElementState.Unactive;
        }
        private void OnUsedCallback_Elapsed(object sender, ElapsedEventArgs e)
        {
            OnUsedCallback.Dispose();

            Character collector = this.Character;

            if (collector != null)
            {
                collector.Client.Send(new InteractiveUseEndedMessage(Record.Identifier, (short)Skill.Id));
            }

            this.Collect();
            UpdateState(StatedElementState.Unactive);
            GrowCallback.Start();
        }
        public void Collect()
        {
            Character collector;

            lock (m_sync)
            {
                if (State != StatedElementState.Used || this.Character == null)
                {
                    return;
                }
                collector = this.Character;
                this.Character = null;
            }

            collector.Collecting = false;

            SkillRecord skill = Skill.Record;
            CharacterJob job = collector.GetJob(skill.ParentJobId);

            int quantity = JobFormulas.Instance.GetCollectedItemQuantity(job != null ? job.Level : 1, skill);

            collector.Inventory.AddItem(skill.GatheredRessourceItem, quantity);
            collector.Client.Send(new ObtainedItemMessage(skill.GatheredRessourceItem, quantity));
            GameplayEventApi.ResourcesHarvested(collector, skill.GatheredRessourceItem, quantity);

            if (job != null)
            {
                collector.AddJobExp(skill.ParentJobId, (long)((5 * skill.MinLevel) * ConfigManager<WorldConfig>.Instance.JobRate));
            }
        }

        /// <summary>
        /// Le recolteur a quitte la carte ou s'est deconnecte : l'element se libere
        /// sans rien donner, sinon il reste bloque jusqu'au prochain redemarrage.
        /// </summary>
        public void OnCollectorLeft(Character character)
        {
            lock (m_sync)
            {
                if (this.Character != character)
                {
                    return;
                }
                this.Character = null;
            }

            character.Collecting = false;
            OnUsedCallback?.Dispose();

            if (State == StatedElementState.Used)
            {
                UpdateState(StatedElementState.Active);
            }
        }
        private void UpdateState(StatedElementState state)
        {
            this.State = state;
            MapInstance.Send(new StatedElementUpdatedMessage(GetStatedElement()));

            this.Update();
        }
        public void Grow()
        {
            if (State == StatedElementState.Unactive)
            {
                UpdateState(StatedElementState.Active);
            }
        }
        public override bool CanUse(Character character)
        {
            return base.CanUse(character)
                && State == StatedElementState.Active
                && this.Character == null
                && HasRequiredJobLevel(character);
        }
    }
}
