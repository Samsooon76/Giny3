using Giny.World.Managers.Entities.Characters;

namespace Giny.World.Api
{
    /// <summary>
    /// Small, server-authoritative event surface for optional progression modules.
    /// Gameplay code only reports facts after they have succeeded; modules decide
    /// whether those facts match an active objective.
    /// </summary>
    public static class GameplayEventApi
    {
        public static event Action<Character, int, int>? OnResourcesHarvested;
        public static event Action<Character, long, int>? OnItemsCrafted;
        public static event Action<Character, string>? OnPokefusCaptured;

        public static void ResourcesHarvested(Character character, int resourceItemId, int quantity)
        {
            if (quantity > 0)
            {
                OnResourcesHarvested?.Invoke(character, resourceItemId, quantity);
            }
        }

        public static void ItemsCrafted(Character character, long recipeId, int quantity)
        {
            if (quantity > 0)
            {
                OnItemsCrafted?.Invoke(character, recipeId, quantity);
            }
        }

        public static void PokefusCaptured(Character character, string rarity)
        {
            OnPokefusCaptured?.Invoke(character, rarity);
        }
    }
}
