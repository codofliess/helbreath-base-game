/**
 * Client ping liveness helpers.
 *
 * `NetworkManager` keeps at most one in-flight RTT sample (`pingSentAt` + sequence).
 * If a response is dropped or the sequence does not match, that lock used to block
 * every later `sendPing` and the server then kicked for silence. These helpers make
 * the send loop retry after a timeout and treat a mismatch as "abandon in-flight".
 */

/** True when an unanswered ping has been outstanding for at least `timeoutMs`. */
export function pingInFlightTimedOut(
    pingSentAt: number | undefined,
    now: number,
    timeoutMs: number,
): boolean {
    if (pingSentAt === undefined) {
        return false;
    }
    return now - pingSentAt >= timeoutMs;
}

/**
 * Whether the interval tick should encode and send a new ping.
 * Socket must be open; an in-flight sample only blocks until it times out.
 */
export function shouldSendClientPing(
    socketOpen: boolean,
    pingSentAt: number | undefined,
    now: number,
    inFlightTimeoutMs: number,
): boolean {
    if (!socketOpen) {
        return false;
    }
    if (pingSentAt === undefined) {
        return true;
    }
    return pingInFlightTimedOut(pingSentAt, now, inFlightTimeoutMs);
}

/** True when the response sequence is the one we are currently measuring. */
export function pingResponseMatchesPending(
    pingSentAt: number | undefined,
    pendingSequence: number | undefined,
    responseSequence: number,
): boolean {
    return pingSentAt !== undefined && pendingSequence === responseSequence;
}

/**
 * Next protobuf `uint32` ping sequence. Avoids JS numbers growing past 32-bit so
 * a truncated wire value cannot permanently mismatch `pendingPingSequence`.
 */
export function nextPingSequenceUint32(current: number): { sequence: number; next: number } {
    const sequence = current < 1 ? 1 : current;
    const next = sequence >= 0xffffffff ? 1 : sequence + 1;
    return { sequence, next };
}
