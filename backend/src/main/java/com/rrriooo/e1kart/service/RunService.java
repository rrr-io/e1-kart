package com.rrriooo.e1kart.service;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rrriooo.e1kart.dto.MeResponse;
import com.rrriooo.e1kart.dto.StartRunResponse;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;
import com.rrriooo.e1kart.model.CertificateKind;
import com.rrriooo.e1kart.model.Player;
import com.rrriooo.e1kart.model.Run;
import com.rrriooo.e1kart.repository.CertificateRepository;
import com.rrriooo.e1kart.repository.RunRepository;

/**
 * Run balance and consumption. The balance isn't a stored counter:
 * it's always (runs granted by certificates) - (runs started), so it can never drift out of sync.
 * Each certificate kind has its own balance: FANS' CHOICE runs for Interstellar, MCD runs for Bloody Paradise.
 */
@Service
public class RunService {

    private final CertificateRepository certificates;
    private final RunRepository runs;

    public RunService(CertificateRepository certificates, RunRepository runs) {
        this.certificates = certificates;
        this.runs = runs;
    }

    @Transactional(readOnly = true)
    public long balance(Player player, CertificateKind kind) {
        return certificates.sumRunsGranted(player.getId(), kind.name()) - runs.countByPlayerIdAndKind(player.getId(), kind.name());
    }

    @Transactional(readOnly = true)
    public MeResponse summary(Player player) {
        return new MeResponse(balance(player, CertificateKind.FANS_CHOICE), balance(player, CertificateKind.MCD),
                certificates.countByPlayerId(player.getId()), runs.countByPlayerId(player.getId()));
    }

    /** Consumes a run of the track's kind. synchronized prevents two simultaneous STARTs from spending the same run. */
    @Transactional
    public synchronized StartRunResponse start(Player player, int team, String track) {
        CertificateKind kind = CertificateKind.forTrack(track);
        long balance = balance(player, kind);
        if (balance <= 0) {
            throw new ApiException(kind == CertificateKind.MCD ? ErrorCode.NO_MCD_RUNS : ErrorCode.NO_RUNS);
        }
        Run run = runs.save(new Run(UUID.randomUUID().toString(), player.getId(), team, kind, Instant.now()));
        return new StartRunResponse(run.getId(), balance - 1);
    }

    @Transactional
    public void finish(Player player, String runId, long timeMs, Integer position) {
        Run run = runs.findByIdAndPlayerId(runId, player.getId()).orElseThrow(() -> new ApiException(ErrorCode.RUN_NOT_FOUND));
        if (!run.isFinished()) {
            run.finish(timeMs, position, Instant.now());
        }
    }
}
