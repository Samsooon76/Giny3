using System.Collections.Concurrent;
using Giny.World.Managers.Entities.Characters;

namespace Giny.World.Managers.Modern
{
    /// <summary>Optional modules explicitly register their player-facing commands after initialization.</summary>
    public static class ModernModuleActions
    {
        private static readonly ConcurrentDictionary<string, Action<ModernActionRequest, Character>> Handlers = new();
        public static IEnumerable<string> Capabilities => Handlers.Keys;
        public static void Register(string action, Action<ModernActionRequest, Character> handler)
        {
            if (!Handlers.TryAdd(action, handler)) throw new InvalidOperationException($"Duplicate modern module action: {action}");
        }
        public static bool Execute(ModernActionRequest request, Character character)
        {
            if (!Handlers.TryGetValue(request.Action, out var handler)) return false;
            handler(request, character);
            return true;
        }
    }
}
