using Giny.World.Managers.Entities.Characters;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Giny.World.Api
{
    public class CharacterEventApi
    {
        public static event Action<Character> OnHumanOptionsCreated;
        public static event Action<Character> OnDisconnected;

        public static void HumanOptionsCreated(Character character)
        {
            OnHumanOptionsCreated?.Invoke(character);
        }

        internal static void Disconnected(Character character)
        {
            OnDisconnected?.Invoke(character);
        }
    }
}
