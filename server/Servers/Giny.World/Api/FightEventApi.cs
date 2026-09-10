using Giny.Protocol.Enums;
using Giny.World.Managers.Fights;
using Giny.World.Managers.Fights.Cast;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Managers.Fights.Results;
using Giny.World.Records.Items;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Api
{
    public class FightEventApi
    {
        public static event Action<FightPlayerResult> OnPlayerResultApplied;
        public static event Action<Fight> OnPlacementStarted;
        public static event Action<Fighter> OnFighterJoined;
        public static event Func<SpellCast, bool> OnSpellCasting;
        /// <summary>
        /// Called after the exact target and effect handlers have been resolved,
        /// but before animation, AP consumption and effect execution. Returning
        /// false cancels the original direct attack as a successfully handled
        /// action (for example a Pokéfus capture).
        /// </summary>
        public static event Func<SpellCastHandler, bool> OnDirectAttackExecuting;

        internal static void PlayerResultApplied(FightPlayerResult fightPlayerResult)
        {
            OnPlayerResultApplied?.Invoke(fightPlayerResult);
        }

        internal static void PlacementStarted(Fight fight)
        {
            OnPlacementStarted?.Invoke(fight);
        }

        internal static void FighterJoined(Fighter fighter)
        {
            OnFighterJoined?.Invoke(fighter);
        }

        internal static bool CanCastSpell(SpellCast cast)
        {
            bool? result = OnSpellCasting?.Invoke(cast);

            if (!result.HasValue)
                return true;
            else
                return result.Value;
        }

        internal static bool CanExecuteDirectAttack(SpellCastHandler handler)
        {
            if (OnDirectAttackExecuting == null)
            {
                return true;
            }

            foreach (Func<SpellCastHandler, bool> callback in OnDirectAttackExecuting.GetInvocationList())
            {
                if (!callback(handler))
                {
                    return false;
                }
            }

            return true;
        }

    }
}
