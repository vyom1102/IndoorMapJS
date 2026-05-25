const resultPanelStyle = {
  background: "#fff",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 14px 40px rgba(24, 31, 52, 0.16)",
  border: "1px solid rgba(24, 31, 52, 0.08)",
  marginTop: 6,
  maxHeight: 280,
  overflowY: "auto",
};

const searchInputStyle = {
  width: "100%",
  height: 44,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid #d8deea",
  background: "#fff",
  color: "#172033",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const iconButtonStyle = {
  width: 58,
  height: 58,
  border: "none",
  borderLeft: "1px solid #d9dde7",
  background: "#f2f3f6",
  color: "#1f2937",
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
};

const disabledIconButtonStyle = {
  ...iconButtonStyle,
  color: "#b2b7c2",
  cursor: "not-allowed",
};

const getFloorLabel = (value) => {
  if (value < 0) return `B${Math.abs(value)}`;
  if (value === 0) return "G";
  return `F${value}`;
};

function SearchResults({ results, onSelect }) {
  if (!results.length) return null;

  return (
    <div style={resultPanelStyle}>
      {results.map((item, i) => (
        <button
          key={`${item.matchedText}-${i}`}
          onClick={() => onSelect(item)}
          style={{
            width: "100%",
            padding: "13px 14px",
            cursor: "pointer",
            border: "none",
            borderBottom:
              i !== results.length - 1 ? "1px solid #eef1f6" : "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            background: "#fff",
            textAlign: "left",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.matchedText}
            </span>
            {item.actualName !== item.matchedText && (
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#6b7280",
                  marginTop: 3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.actualName}
              </span>
            )}
          </span>
          <span
            style={{
              minWidth: 44,
              height: 24,
              borderRadius: 999,
              background: "#edf3ff",
              color: "#2754d8",
              fontSize: 12,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 9px",
              flexShrink: 0,
            }}
          >
            {item.floorLabel}
          </span>
        </button>
      ))}
    </div>
  );
}

function RouteStepsPanel({ routeSummary, onCloseSteps, onStartNavigation }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 18,
        left: 18,
        bottom: 18,
        zIndex: 24,
        width: 380,
        maxWidth: "calc(100vw - 36px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(255,244,248,0.97) 100%)",
          borderRadius: 12,
          boxShadow: "0 22px 54px rgba(17, 24, 39, 0.2)",
          border: "1px solid rgba(17, 24, 39, 0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 18px 12px",
            borderBottom: "1px solid #eef1f6",
          }}
        >
          <button
            type="button"
            onClick={onCloseSteps}
            aria-label="Back to directions"
            style={{
              width: 36,
              height: 36,
              border: "none",
              borderRadius: 8,
              background: "#f3f5f9",
              color: "#1f2937",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <h2
            style={{
              margin: 0,
              flex: 1,
              fontSize: 22,
              fontWeight: 900,
              color: "#111827",
            }}
          >
            Route Details
          </h2>
        </div>

        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eef1f6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "#edf3ff",
                color: "#2f57d6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ◉
            </div>
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#111827",
                  lineHeight: 1.1,
                }}
              >
                {routeSummary.destinationName}
              </div>
              <div style={{ color: "#667085", fontSize: 13, marginTop: 4 }}>
                {routeSummary.destinationArea}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 14,
              color: "#667085",
              fontSize: 13,
            }}
          >
            <span>{routeSummary.duration}</span>
            <span>{routeSummary.distance}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 12px" }}>
          {routeSummary.routeSteps?.map((step, index) => (
            <div
              key={`${step.instruction}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 42px 1fr auto",
                gap: 12,
                alignItems: "start",
                padding: "14px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingTop: 4,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: index === 0 ? "#2f57d6" : "#d0d7e6",
                  }}
                />
                {index !== routeSummary.routeSteps.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 36,
                      marginTop: 6,
                      background: "#e5eaf3",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: "#f3f6fc",
                  color: "#2f57d6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {step.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#111827",
                    lineHeight: 1.35,
                  }}
                >
                  {step.instruction}
                </div>
              </div>
              <div
                style={{
                  color: "#667085",
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  paddingTop: 2,
                }}
              >
                {step.distance}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "14px 18px 18px",
            borderTop: "1px solid #eef1f6",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onCloseSteps}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 8,
              border: "1px solid #d9deeb",
              background: "#fff",
              color: "#1f2937",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={onStartNavigation}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 8,
              border: "none",
              background: "#2f57d6",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 10px 22px rgba(47, 87, 214, 0.28)",
            }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IndoorMapUI({
  sourceQuery,
  destQuery,
  sourceResults,
  destResults,
  venueData,
  floor,
  onSourceSearch,
  onDestSearch,
  onSourceSelect,
  onDestSelect,
  onFloorSwitch,
  routeSummary,
  onOpenSteps,
  onCloseSteps,
  onStartNavigation,
  onEndNavigation,
  onClearDirections,
  onPreviousStep,
  onNextStep,
  containerRef,
}) {
  const hasRoute = routeSummary?.hasRoute;
  const isNavigating = routeSummary?.isNavigating;
  const showStepsPreview = routeSummary?.showStepsPreview;

  return (
    <>
      <style>
        {`
          @keyframes routePulse {
            0% { transform: scale(0.8); opacity: 0.9; }
            100% { transform: scale(1.9); opacity: 0; }
          }
        `}
      </style>

      <div ref={containerRef} style={{ height: "100%" }} />

      {showStepsPreview && hasRoute && (
        <RouteStepsPanel
          routeSummary={routeSummary}
          onCloseSteps={onCloseSteps}
          onStartNavigation={onStartNavigation}
        />
      )}

      {!isNavigating && !showStepsPreview && (
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            zIndex: 20,
            width: 360,
            maxWidth: "calc(100vw - 36px)",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 18px 48px rgba(17, 24, 39, 0.18)",
              border: "1px solid rgba(17, 24, 39, 0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 18px 14px" }}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 22,
                  lineHeight: 1.1,
                  color: "#111827",
                  fontWeight: 800,
                }}
              >
                Directions
              </h2>

              <div style={{ display: "grid", gap: 10 }}>
                <input
                  aria-label="Source"
                  placeholder="Choose starting point"
                  value={sourceQuery}
                  onChange={(e) => onSourceSearch(e.target.value)}
                  style={searchInputStyle}
                />
                <SearchResults results={sourceResults} onSelect={onSourceSelect} />

                <input
                  aria-label="Destination"
                  placeholder="Choose destination"
                  value={destQuery}
                  onChange={(e) => onDestSearch(e.target.value)}
                  style={searchInputStyle}
                />
                <SearchResults results={destResults} onSelect={onDestSelect} />
              </div>

              <div style={{ marginTop: 14, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={onClearDirections}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#dc534a",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {hasRoute && (
              <div
                style={{
                  borderTop: "1px solid #eef1f6",
                  padding: "16px 18px 18px",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 24,
                    lineHeight: 1.05,
                    color: "#111827",
                    fontWeight: 900,
                  }}
                >
                  {routeSummary.duration}
                </h3>
                <div style={{ color: "#667085", fontSize: 13, marginTop: 4 }}>
                  {routeSummary.distance}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={onOpenSteps}
                    style={{
                      flex: 1,
                      height: 42,
                      borderRadius: 8,
                      border: "1px solid #d9deeb",
                      background: "#fff",
                      color: "#1f2937",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Steps
                  </button>
                  <button
                    type="button"
                    onClick={onStartNavigation}
                    style={{
                      flex: 1,
                      height: 42,
                      borderRadius: 8,
                      border: "none",
                      background: "#2f57d6",
                      color: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 10px 22px rgba(47, 87, 214, 0.28)",
                    }}
                  >
                    Start
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isNavigating && (
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            zIndex: 22,
            width: 360,
            maxWidth: "calc(100vw - 36px)",
          }}
        >
          <div
            style={{
              background: "#3152b9",
              color: "#fff",
              borderRadius: 8,
              padding: "20px 22px",
              boxShadow: "0 18px 46px rgba(49, 82, 185, 0.22)",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 52, lineHeight: 0.8 }}>
              {routeSummary.routeSteps?.[routeSummary.currentStep - 1]?.icon ||
                "↰"}
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
                {routeSummary.stepDistance}
              </div>
              <div style={{ fontSize: 15, marginTop: 4 }}>
                {routeSummary.instruction}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 18px 48px rgba(17, 24, 39, 0.18)",
              border: "1px solid rgba(17, 24, 39, 0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                borderBottom: "1px solid #eef1f6",
              }}
            >
              <div style={{ flex: 1, padding: "18px 12px 18px 18px" }}>
                <div style={{ color: "#667085", fontSize: 13 }}>
                  Time to Destination
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: "#111827",
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                >
                  {routeSummary.duration}
                </div>
                <div style={{ marginTop: 6, color: "#667085", fontSize: 12 }}>
                  Step {routeSummary.currentStep} of {routeSummary.totalSteps}
                </div>
              </div>
              <button
                type="button"
                disabled={!routeSummary.canGoBack}
                onClick={onPreviousStep}
                style={
                  routeSummary.canGoBack ? iconButtonStyle : disabledIconButtonStyle
                }
                aria-label="Previous route step"
              >
                ‹
              </button>
              <button
                type="button"
                disabled={!routeSummary.canGoNext}
                onClick={onNextStep}
                style={
                  routeSummary.canGoNext ? iconButtonStyle : disabledIconButtonStyle
                }
                aria-label="Next route step"
              >
                ›
              </button>
            </div>
            <div style={{ padding: "12px 12px 12px 18px", textAlign: "right" }}>
              <button
                type="button"
                onClick={onEndNavigation}
                style={{
                  height: 40,
                  border: "none",
                  borderRadius: 8,
                  background: "#d9534f",
                  color: "#fff",
                  padding: "0 18px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                End Navigation
              </button>
            </div>
          </div>
        </div>
      )}

      {venueData?.floors?.length > 1 && (
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            zIndex: 18,
            display: "grid",
            gap: 8,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 6,
              boxShadow: "0 14px 36px rgba(24, 31, 52, 0.12)",
              border: "1px solid rgba(24, 31, 52, 0.08)",
              display: "grid",
              gap: 4,
            }}
          >
            {venueData.floors.map((f) => (
              <button
                key={f}
                onClick={() => onFloorSwitch(f)}
                style={{
                  height: 34,
                  minWidth: 88,
                  cursor: "pointer",
                  borderRadius: 8,
                  border: "none",
                  background: f === floor ? "#2f57d6" : "#f1f4f9",
                  color: f === floor ? "#fff" : "#1f2937",
                  fontWeight: 900,
                }}
              >
                {getFloorLabel(f)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
