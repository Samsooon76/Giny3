"""Hand-written reader for the Dofus 3 IL2CPP metadata and GameAssembly.

See `docs/IL2CPP.md` for the proofs and `docs/RETROINGENIERIE.md` for what
the two files unlock together.
"""

from extractor.il2cpp.binary import Binary
from extractor.il2cpp.metadata import SANITY, VERSION, Metadata

__all__ = ["Binary", "Metadata", "SANITY", "VERSION"]
