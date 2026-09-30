namespace Server.Persistence;

/// <summary>
/// Character writes. Updates address <c>characters.id</c>.
/// Inserts do not use <c>ON CONFLICT (account_wallet, name)</c>, which does not cover <c>idx_characters_name_ci</c>.
/// </summary>
public static class CharacterSql {
    public const string UpdateById = """
        UPDATE characters SET
            world_id = @worldId,
            pos_x = @x,
            pos_y = @y,
            state_json = @stateJson::jsonb,
            slot_index = @slotIndex,
            hours_played = @hoursPlayed,
            updated_at = NOW()
        WHERE id = @id AND account_wallet = @wallet
        """;

    public const string Insert = """
        INSERT INTO characters (
            account_wallet, name, world_id, pos_x, pos_y, state_json, slot_index, hours_played, updated_at)
        VALUES (
            @wallet, @name, @worldId, @x, @y, @stateJson::jsonb, @slotIndex, @hoursPlayed, NOW())
        RETURNING id
        """;

    public const string Rename = """
        UPDATE characters SET
            name = @newName,
            state_json = jsonb_set(
                jsonb_set(
                    COALESCE(state_json, '{}'::jsonb),
                    '{CharacterName}',
                    to_jsonb(@newName::text),
                    true),
                '{CharacterDbId}',
                to_jsonb(@id::text),
                true),
            updated_at = NOW()
        WHERE id = @id
          AND account_wallet = @wallet
          AND LOWER(name) = LOWER(@currentName)
        """;

    public const string FindByLowerName = """
        SELECT id, account_wallet, name,
               COALESCE(state_json->>'NameReservationOnly', '') = 'true' AS reservation_only
        FROM characters
        WHERE LOWER(name) = LOWER(@name)
        LIMIT 1
        """;

    public const string LockName = """
        SELECT pg_advisory_xact_lock(hashtext(LOWER(@name)))
        """;
}
