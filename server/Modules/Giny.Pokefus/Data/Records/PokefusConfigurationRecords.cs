using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using System.Collections.Concurrent;

namespace Giny.Pokefus.Data.Records
{
    [Table("pokefus_capture_configuration")]
    public class PokefusCaptureConfigurationRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, PokefusCaptureConfigurationRecord> Configurations = new();

        [Primary]
        public long Id { get; set; }

        [Update]
        [TypeOverride("DOUBLE")]
        public double NormalSpawnRate { get; set; }

        [Update]
        [TypeOverride("DOUBLE")]
        public double LegendarySpawnRate { get; set; }

        [Update]
        [TypeOverride("DOUBLE")]
        public double CaptureRate { get; set; }

        [Ignore]
        public static PokefusCaptureConfigurationRecord Current =>
            Configurations.Values.FirstOrDefault() ?? new PokefusCaptureConfigurationRecord
            {
                Id = 1,
                NormalSpawnRate = 0.01d,
                LegendarySpawnRate = 0.0001d,
                CaptureRate = 0.50d,
            };
    }

    [Table("pokefus_capture_nets")]
    public class PokefusCaptureNetRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, PokefusCaptureNetRecord> Nets = new();

        [Primary]
        public long Id { get; set; }

        [Update]
        public int ItemGid { get; set; }

        [Update]
        public short MinMonsterLevel { get; set; }

        [Update]
        public short MaxMonsterLevel { get; set; }

        [Update]
        public bool Enabled { get; set; }

        public static PokefusCaptureNetRecord? GetByItemGid(int itemGid)
        {
            return Nets.Values.FirstOrDefault(x => x.Enabled && x.ItemGid == itemGid);
        }

        public static PokefusCaptureNetRecord? GetForLevel(short level)
        {
            return Nets.Values
                .Where(x => x.Enabled && level >= x.MinMonsterLevel && level <= x.MaxMonsterLevel)
                .OrderBy(x => x.MinMonsterLevel)
                .FirstOrDefault();
        }

        public static IEnumerable<PokefusCaptureNetRecord> GetNets()
        {
            return Nets.Values.OrderBy(x => x.MinMonsterLevel);
        }
    }

    [Table("pokefus_species")]
    public class PokefusSpeciesRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, PokefusSpeciesRecord> Species = new();

        [Primary]
        public long Id { get; set; }

        [Update]
        public long MonsterId { get; set; }

        [Update]
        public string Name { get; set; } = string.Empty;

        [Update]
        public bool CaptureEnabled { get; set; }

        [Update]
        [TypeOverride("DOUBLE")]
        public double CaptureRate { get; set; }

        [Update]
        public byte MaximumHealthPercent { get; set; }

        [Update]
        public int? RequiredItemId { get; set; }

        [Update]
        public byte MaxActiveGenes { get; set; }

        [Update]
        public bool Enabled { get; set; }

        [Update]
        public bool SpawnEligible { get; set; }

        public static PokefusSpeciesRecord? GetSpecies(long id)
        {
            Species.TryGetValue(id, out PokefusSpeciesRecord? species);
            return species;
        }

        public static PokefusSpeciesRecord? GetSpeciesByMonster(long monsterId)
        {
            return Species.Values.FirstOrDefault(x => x.MonsterId == monsterId);
        }

        public static IEnumerable<PokefusSpeciesRecord> GetSpecies()
        {
            return Species.Values;
        }
    }

    [Table("pokefus_genome_branches")]
    public class PokefusGenomeBranchRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, PokefusGenomeBranchRecord> Branches = new();

        [Primary]
        public long Id { get; set; }

        [Update]
        public long SpeciesId { get; set; }

        [Update]
        public string Name { get; set; } = string.Empty;

        [Update]
        public short DisplayOrder { get; set; }

        [Update]
        public bool Enabled { get; set; }

        public static PokefusGenomeBranchRecord? GetBranch(long id)
        {
            Branches.TryGetValue(id, out PokefusGenomeBranchRecord? branch);
            return branch;
        }

        public static IEnumerable<PokefusGenomeBranchRecord> GetBranches()
        {
            return Branches.Values.OrderBy(x => x.SpeciesId).ThenBy(x => x.DisplayOrder);
        }

        public static IEnumerable<PokefusGenomeBranchRecord> GetBranches(long speciesId)
        {
            return Branches.Values
                .Where(x => x.SpeciesId == speciesId)
                .OrderBy(x => x.DisplayOrder);
        }
    }

    [Table("pokefus_genes")]
    public class PokefusGeneRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, PokefusGeneRecord> Genes = new();

        [Primary]
        public long Id { get; set; }

        [Update]
        public long SpeciesId { get; set; }

        [Update]
        public long BranchId { get; set; }

        [Update]
        public string Name { get; set; } = string.Empty;

        [Update]
        [TypeOverride("TEXT")]
        public string Description { get; set; } = string.Empty;

        [Update]
        public byte Tier { get; set; }

        [Update]
        public long XpCost { get; set; }

        [Update]
        public long KamaCost { get; set; }

        [Update]
        public int OgrineCost { get; set; }

        [Update]
        public long? PrerequisiteGeneId { get; set; }

        [Update]
        public int? IconId { get; set; }

        [Update]
        public string EffectType { get; set; } = string.Empty;

        [Update]
        [TypeOverride("LONGTEXT")]
        public string EffectParameters { get; set; } = "{}";

        [Update]
        public bool Enabled { get; set; }

        [Update]
        public short DisplayOrder { get; set; }

        public static PokefusGeneRecord? GetGene(long id)
        {
            Genes.TryGetValue(id, out PokefusGeneRecord? gene);
            return gene;
        }

        public static IEnumerable<PokefusGeneRecord> GetGenes()
        {
            return Genes.Values
                .OrderBy(x => x.SpeciesId)
                .ThenBy(x => x.BranchId)
                .ThenBy(x => x.DisplayOrder);
        }

        public static IEnumerable<PokefusGeneRecord> GetGenes(long speciesId)
        {
            return Genes.Values
                .Where(x => x.SpeciesId == speciesId)
                .OrderBy(x => x.BranchId)
                .ThenBy(x => x.DisplayOrder);
        }
    }
}
