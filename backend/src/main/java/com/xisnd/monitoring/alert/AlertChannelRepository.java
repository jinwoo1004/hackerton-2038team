package com.xisnd.monitoring.alert;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertChannelRepository extends JpaRepository<AlertChannel, Long> {

    List<AlertChannel> findByUserIdOrderByCreatedAtAsc(Long userId);

    Optional<AlertChannel> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);
}
