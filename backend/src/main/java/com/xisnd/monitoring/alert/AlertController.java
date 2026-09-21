package com.xisnd.monitoring.alert;

import com.xisnd.monitoring.alert.AlertDtos.ChannelRequest;
import com.xisnd.monitoring.alert.AlertDtos.ChannelResponse;
import com.xisnd.monitoring.alert.AlertDtos.DeliveryResponse;
import com.xisnd.monitoring.alert.AlertDtos.RuleRequest;
import com.xisnd.monitoring.alert.AlertDtos.RuleResponse;
import com.xisnd.monitoring.alert.AlertDtos.TestResult;
import com.xisnd.monitoring.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;

    @GetMapping("/channels")
    public List<ChannelResponse> channels() {
        return alertService.channels(CurrentUser.id());
    }

    @PostMapping("/channels")
    public ResponseEntity<ChannelResponse> createChannel(@Valid @RequestBody ChannelRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(alertService.createChannel(CurrentUser.id(), request));
    }

    @PutMapping("/channels/{channelId}")
    public ChannelResponse updateChannel(@PathVariable Long channelId, @Valid @RequestBody ChannelRequest request) {
        return alertService.updateChannel(CurrentUser.id(), channelId, request);
    }

    @DeleteMapping("/channels/{channelId}")
    public ResponseEntity<Void> deleteChannel(@PathVariable Long channelId) {
        alertService.deleteChannel(CurrentUser.id(), channelId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/channels/{channelId}/test")
    public TestResult test(@PathVariable Long channelId) {
        return alertService.test(CurrentUser.id(), channelId);
    }

    @GetMapping("/rules")
    public List<RuleResponse> rules() {
        return alertService.rules(CurrentUser.id());
    }

    @PostMapping("/rules")
    public ResponseEntity<RuleResponse> createRule(@Valid @RequestBody RuleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(alertService.createRule(CurrentUser.id(), request));
    }

    @PutMapping("/rules/{ruleId}")
    public RuleResponse updateRule(@PathVariable Long ruleId, @Valid @RequestBody RuleRequest request) {
        return alertService.updateRule(CurrentUser.id(), ruleId, request);
    }

    @DeleteMapping("/rules/{ruleId}")
    public ResponseEntity<Void> deleteRule(@PathVariable Long ruleId) {
        alertService.deleteRule(CurrentUser.id(), ruleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/deliveries")
    public List<DeliveryResponse> deliveries(@RequestParam(defaultValue = "30") int limit) {
        return alertService.deliveries(CurrentUser.id(), limit);
    }
}
