package com.rrriooo.e1kart.service;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rrriooo.e1kart.dto.MeResponse;
import com.rrriooo.e1kart.dto.StartRunResponse;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;
import com.rrriooo.e1kart.model.Player;
import com.rrriooo.e1kart.model.Run;
import com.rrriooo.e1kart.repository.CertificateRepository;
import com.rrriooo.e1kart.repository.RunRepository;

/**
 * Run balance and consumption. The balance isn't a stored counter:
 * it's always (runs granted by certificates) - (runs started), so it can never drift out of sync.
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
    public long balance(Player player) {
        return certificates.sumRunsGranted(player.getId()) - runs.countByPlayerId(player.getId());
    }

    @Transactional(readOnly = true)
    public MeResponse summary(Player player) {
        return new MeResponse(balance(player), certificates.countByPlayerId(player.getId()), runs.countByPlayerId(player.getId()));
    }

    /** Consumes a run. synchronized prevents two simultaneous STARTs from spending the same run. */
    @Transactional
    public synchronized StartRunResponse start(Player player, int team) {
        long balance = balance(player);
        if (balance <= 0) {
            throw new ApiException(ErrorCode.NO_RUNS);
        }
        Run run = runs.save(new Run(UUID.randomUUID().toString(), player.getId(), team, Instant.now()));
        return new StartRunResponse(run.getId(), balance - 1);
    }

    @Transactional
    public void finish(Player player, String runId, long timeMs) {
        Run run = runs.findByIdAndPlayerId(runId, player.getId()).orElseThrow(() -> new ApiException(ErrorCode.RUN_NOT_FOUND));
        if (!run.isFinished()) {
            run.finish(timeMs, Instant.now());
        }
    }
}
