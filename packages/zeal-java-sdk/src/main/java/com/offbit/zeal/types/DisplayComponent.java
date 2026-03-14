package com.offbit.zeal.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Web Component display configuration for custom node rendering.
 */
public class DisplayComponent {
    @JsonProperty("element")
    private String element;

    @JsonProperty("bundleId")
    private String bundleId;

    @JsonProperty("source")
    private String source;

    @JsonProperty("shadow")
    private Boolean shadow;

    @JsonProperty("observedProps")
    private List<String> observedProps;

    @JsonProperty("width")
    private String width;

    public DisplayComponent() {}

    public DisplayComponent(String element) {
        this.element = element;
    }

    public String getElement() { return element; }
    public void setElement(String element) { this.element = element; }

    public String getBundleId() { return bundleId; }
    public void setBundleId(String bundleId) { this.bundleId = bundleId; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public Boolean getShadow() { return shadow; }
    public void setShadow(Boolean shadow) { this.shadow = shadow; }

    public List<String> getObservedProps() { return observedProps; }
    public void setObservedProps(List<String> observedProps) { this.observedProps = observedProps; }

    public String getWidth() { return width; }
    public void setWidth(String width) { this.width = width; }
}
