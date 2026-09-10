using Giny.Core.DesignPattern;
using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Types;
using Giny.World.Managers.Criterias;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Generic;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Records.Maps
{
    [Table("interactive_skills")]
    public class InteractiveSkillRecord : IRecord
    {
        [Container]
        private static Dictionary<long, InteractiveSkillRecord> InteractiveSkills = new Dictionary<long, InteractiveSkillRecord>();

        [Primary]
        public long Id
        {
            get;
            set;
        }
        public long MapId
        {
            get;
            set;
        }
        public long Identifier
        {
            get;
            set;
        }
        [Update]
        public GenericActionEnum ActionIdentifier
        {
            get;
            set;
        }
        [Update]
        public InteractiveTypeEnum Type
        {
            get;
            set;
        }
        [Update]
        public SkillTypeEnum SkillId
        {
            get;
            set;
        }
        [Ignore]
        public SkillRecord Record
        {
            get;
            set;
        }
        [Update]
        public string Param1
        {
            get;
            set;
        }
        [Update]
        public string Param2
        {
            get;
            set;
        }
        [Update]
        public string Param3
        {
            get;
            set;
        }
        public static long PopNextId()
        {
            if (InteractiveSkills.Count == 0)
            {
                return 1;
            }
            else
            {
                return InteractiveSkills.Keys.Last() + 1;
            }
        }
        public string Criteria
        {
            get;
            set;
        }

        public static bool Exist(int identifier)
        {
            return GetInteractiveSkill(identifier) != null;
        }
        public static bool ExistAndHandled(int identifier)
        {
            InteractiveSkillRecord record = GetInteractiveSkill(identifier);
            return record != null && record.ActionIdentifier != GenericActionEnum.Unhandled;
        }

        /*
         * Les 44 000 elements des cartes cherchent tous leur skill au demarrage.
         * Un scan lineaire sur 17 000 lignes rend ce chargement quadratique :
         * les deux index sont construits une seule fois, a la premiere demande.
         */
        /*
         * Concurrents : les cartes lisent ces index depuis les threads clients pendant
         * qu'une commande admin ou un zaap decouvert peut en ajouter une entree.
         */
        private static ConcurrentDictionary<long, InteractiveSkillRecord> m_byIdentifier;
        private static ConcurrentDictionary<(long MapId, long Identifier), InteractiveSkillRecord> m_byMapAndIdentifier;
        private static readonly object m_indexSync = new object();

        private static void EnsureIndex()
        {
            if (m_byIdentifier != null)
            {
                return;
            }
            lock (m_indexSync)
            {
                if (m_byIdentifier != null)
                {
                    return;
                }
                var byIdentifier = new ConcurrentDictionary<long, InteractiveSkillRecord>();
                var byMapAndIdentifier = new ConcurrentDictionary<(long, long), InteractiveSkillRecord>();

                foreach (var skill in InteractiveSkills.Values)
                {
                    /* Premier arrive, premier servi : meme resultat que l'ancien FirstOrDefault. */
                    byIdentifier.TryAdd(skill.Identifier, skill);
                    byMapAndIdentifier.TryAdd((skill.MapId, skill.Identifier), skill);
                }
                m_byMapAndIdentifier = byMapAndIdentifier;
                m_byIdentifier = byIdentifier;
            }
        }

        /// <summary>
        /// Enregistre dans les index un skill cree a chaud (commande admin, zaap decouvert).
        /// </summary>
        public static void Index(InteractiveSkillRecord record)
        {
            if (record == null)
            {
                return;
            }
            EnsureIndex();
            m_byIdentifier.TryAdd(record.Identifier, record);
            m_byMapAndIdentifier[(record.MapId, record.Identifier)] = record;
        }

        public static InteractiveSkillRecord GetInteractiveSkill(long id)
        {
            EnsureIndex();
            return m_byIdentifier.TryGetValue(id, out InteractiveSkillRecord record) ? record : null;
        }

        /// <summary>
        /// Un meme identifiant d'element est reutilise par plus de 10 000 cartes : la ligne
        /// declaree pour <paramref name="mapId"/> gagne quand elle existe. Sinon on retombe
        /// sur la recherche par identifiant seul, car la colonne MapId n'est renseignee
        /// correctement que pour une partie des lignes de collecte.
        /// </summary>
        public static InteractiveSkillRecord GetInteractiveSkill(long mapId, long id)
        {
            EnsureIndex();

            if (m_byMapAndIdentifier.TryGetValue((mapId, id), out InteractiveSkillRecord exact))
            {
                return exact;
            }
            return GetInteractiveSkill(id);
        }

        [StartupInvoke("Interactive skills members", StartupInvokePriority.SixthPath)]
        public static void Initialize()
        {
            foreach (var skill in InteractiveSkills.Values)
            {
                skill.Record = SkillRecord.GetSkill(skill.SkillId);
            }
        }
        public static IEnumerable<InteractiveSkillRecord> GetInteractiveSkills()
        {
            return InteractiveSkills.Values;
        }
        public override string ToString()
        {
            return "{" + Identifier + "} " + ActionIdentifier;
        }

    }
}
