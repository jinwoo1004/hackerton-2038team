package com.xisnd.monitoring.alert;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertDeliveryRepository extends JpaRepository<AlertDelivery, Long> {

    List<AlertDelivery> findByUserIdOrderBySentAtDescIdDesc(Long userId, Pageable pageable);

    boolean existsByChannelIdAndDedupKeyAndKindInAndSuccessTrueAndSentAtAfter(
            Long channelId, String dedupKey, Collection<DeliveryKind> kinds, LocalDateTime after);
}
