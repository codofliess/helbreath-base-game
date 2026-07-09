using System;

public static class NftDropRules
{
    // ==================== REGLAS DE NFT DROPS ====================
    // Acá podés modificar fácilmente qué items se convierten en NFTs
    public static bool EsRareDrop(ItemDrop drop)
    {
        // Regla 1: Es segundo drop (o drop adicional)
        if (drop.EsSegundoDrop)
            return true;

        // Regla 2: Hitting Probability > 40
        if (drop.HitRate > 40)
            return true;

        // Regla 3: REP +6 o +7
        if (drop.Rep >= 6)
            return true;

        // Regla 4: Stats de ropa/armadura ≥ 35% en cualquiera de estos
        if (drop.StatHP >= 35 || drop.StatDR >= 35 ||
            drop.StatMR >= 35 || drop.StatMA >= 35 ||
            drop.StatPA >= 35 || drop.StatMP >= 35)
            return true;

        // Podés agregar más reglas aquí fácilmente
        return false;
    }
}

// Clase auxiliar (ajustala si tu código ya tiene una clase ItemDrop diferente)
public class ItemDrop
{
    public bool EsSegundoDrop { get; set; }
    public int HitRate { get; set; }
    public int Rep { get; set; }
    public int StatHP { get; set; }
    public int StatDR { get; set; }
    public int StatMR { get; set; }
    public int StatMA { get; set; }
    public int StatPA { get; set; }
    public int StatMP { get; set; }
    // Agregá aquí otros campos que ya uses en tu código
}