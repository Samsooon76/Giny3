using Giny.Core;
using Giny.ORM;
using Giny.ORM.Interfaces;
using Giny.Pokefus.Data.Records;
using Giny.World.Records.Monsters;
using System.Reflection;

namespace Giny.Pokefus.Data
{
    public static class PokefusDataManager
    {
        private static readonly string[] MigrationResourceSuffixes =
        {
            "001_pokefus_genome_phase1.sql",
            "002_pokefus_capture_nets.sql",
        };

        private static readonly Type[] RecordTypes =
        {
            typeof(PokefusCaptureConfigurationRecord),
            typeof(PokefusCaptureNetRecord),
            typeof(PokefusSpeciesRecord),
            typeof(PokefusGenomeBranchRecord),
            typeof(PokefusGeneRecord),
            typeof(PokefusRecord),
            typeof(PlayerPokefusSpeciesProgressRecord),
            typeof(PlayerPokefusResearchedGeneRecord),
            typeof(PokefusUnlockedGeneRecord),
            typeof(PokefusEquippedGeneRecord),
        };

        public static void Initialize()
        {
            ApplyEmbeddedMigration();
            DatabaseManager.Instance.RegisterTables(RecordTypes);
            ValidateConfiguration();

            Logger.Write(
                $"Pokéfus genome data loaded: {PokefusSpeciesRecord.GetSpecies().Count()} species, " +
                $"{PokefusGenomeBranchRecord.GetBranches().Count()} branches, " +
                $"{PokefusGeneRecord.GetGenes().Count()} genes.",
                Channels.Info);
        }

        public static void ValidateConfiguration()
        {
            PokefusCaptureConfigurationRecord capture = PokefusCaptureConfigurationRecord.Current;
            ValidateRate(nameof(capture.NormalSpawnRate), capture.NormalSpawnRate);
            ValidateRate(nameof(capture.LegendarySpawnRate), capture.LegendarySpawnRate);
            ValidateRate(nameof(capture.CaptureRate), capture.CaptureRate);

            PokefusCaptureNetRecord[] nets = PokefusCaptureNetRecord.GetNets()
                .Where(x => x.Enabled)
                .ToArray();
            foreach (PokefusCaptureNetRecord net in nets)
            {
                if (net.ItemGid <= 0 || net.MinMonsterLevel < 1 || net.MaxMonsterLevel < net.MinMonsterLevel)
                {
                    throw new InvalidDataException(
                        $"Pokéfus capture net {net.Id} has an invalid item or level range.");
                }
            }

            if (nets.Length == 0)
            {
                Logger.Write(
                    "No Pokéfus capture net is enabled. Configure targetable item GIDs in pokefus_capture_nets.",
                    Channels.Warning);
            }

            foreach (var branch in PokefusGenomeBranchRecord.GetBranches())
            {
                if (PokefusSpeciesRecord.GetSpecies(branch.SpeciesId) == null)
                {
                    throw new InvalidDataException(
                        $"Pokéfus branch {branch.Id} references missing species {branch.SpeciesId}.");
                }
            }

            foreach (var gene in PokefusGeneRecord.GetGenes())
            {
                if (PokefusSpeciesRecord.GetSpecies(gene.SpeciesId) == null)
                {
                    throw new InvalidDataException(
                        $"Pokéfus gene {gene.Id} references missing species {gene.SpeciesId}.");
                }

                var branch = PokefusGenomeBranchRecord.GetBranch(gene.BranchId);
                if (branch == null || branch.SpeciesId != gene.SpeciesId)
                {
                    throw new InvalidDataException(
                        $"Pokéfus gene {gene.Id} references an invalid branch {gene.BranchId}.");
                }

                if (gene.PrerequisiteGeneId.HasValue)
                {
                    var prerequisite = PokefusGeneRecord.GetGene(gene.PrerequisiteGeneId.Value);
                    if (prerequisite == null || prerequisite.SpeciesId != gene.SpeciesId)
                    {
                        throw new InvalidDataException(
                            $"Pokéfus gene {gene.Id} has invalid prerequisite {gene.PrerequisiteGeneId.Value}.");
                    }
                }
            }

            foreach (var species in PokefusSpeciesRecord.GetSpecies())
            {
                if (species.MonsterId < short.MinValue ||
                    species.MonsterId > short.MaxValue ||
                    MonsterRecord.GetMonsterRecord((short)species.MonsterId) == null)
                {
                    Logger.Write(
                        $"Pokéfus species {species.Id} references missing monster {species.MonsterId}.",
                        Channels.Warning);
                }
            }
        }

        private static void ValidateRate(string name, double rate)
        {
            if (double.IsNaN(rate) || double.IsInfinity(rate) || rate < 0d || rate > 1d)
            {
                throw new InvalidDataException($"Pokéfus {name} must be a probability between 0 and 1.");
            }
        }

        private static void ApplyEmbeddedMigration()
        {
            Assembly assembly = typeof(PokefusDataManager).Assembly;
            foreach (string suffix in MigrationResourceSuffixes)
            {
                string? resourceName = assembly.GetManifestResourceNames()
                    .SingleOrDefault(x => x.EndsWith(suffix, StringComparison.Ordinal));

                if (resourceName == null)
                {
                    throw new InvalidDataException(
                        $"Embedded Pokéfus migration '{suffix}' was not found.");
                }

                using Stream stream = assembly.GetManifestResourceStream(resourceName)
                    ?? throw new InvalidDataException($"Unable to open Pokéfus migration '{resourceName}'.");
                using StreamReader reader = new StreamReader(stream);
                DatabaseManager.Instance.ExecuteScript(reader.ReadToEnd());
            }
        }
    }
}
