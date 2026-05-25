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
  containerRef,
}) {
  return (
    <>
      {/* SEARCH PANEL */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 20,
          width: 260,
        }}
      >
        <input
          placeholder="Search Source"
          value={sourceQuery}
          onChange={(e) => onSourceSearch(e.target.value)}
          style={{
            width: "100%",
            padding: 8,
            marginBottom: 6,
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />
        {sourceResults.length > 0 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              border: "1px solid #eee",
              marginTop: 4,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {sourceResults.map((item, i) => (
              <div
                key={i}
                onClick={() => onSourceSelect(item)}
                style={{
                  padding: "14px 16px",
                  cursor: "pointer",
                  borderBottom:
                    i !== sourceResults.length - 1
                      ? "1px solid #f3f3f3"
                      : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  transition: "background 0.2s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.matchedText}
                  </div>

                  {item.actualName !== item.matchedText && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#777",
                        marginTop: 3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.actualName}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    minWidth: 52,
                    height: 26,
                    borderRadius: 999,
                    background: "#EEF4FF",
                    color: "#2563EB",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 10px",
                    flexShrink: 0,
                  }}
                >
                  {item.floorLabel}
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          placeholder="Search Destination"
          value={destQuery}
          onChange={(e) => onDestSearch(e.target.value)}
          style={{
            width: "100%",
            padding: 8,
            marginTop: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />
        {destResults.length > 0 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              border: "1px solid #eee",
              marginTop: 4,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {destResults.map((item, i) => (
              <div
                key={i}
                onClick={() => onDestSelect(item)}
                style={{
                  padding: "14px 16px",
                  cursor: "pointer",
                  borderBottom:
                    i !== destResults.length - 1
                      ? "1px solid #f3f3f3"
                      : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.matchedText}
                  </div>

                  {item.actualName !== item.matchedText && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#777",
                        marginTop: 3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.actualName}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    minWidth: 52,
                    height: 26,
                    borderRadius: 999,
                    background: "#EEF4FF",
                    color: "#2563EB",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 10px",
                    flexShrink: 0,
                  }}
                >
                  {item.floorLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FLOOR SWITCHER */}
      {venueData?.floors?.length > 1 && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 10,
            background: "#fff",
            borderRadius: 8,
            padding: 8,
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          {venueData.floors.map((f) => (
            <button
              key={f}
              onClick={() => onFloorSwitch(f)}
              style={{
                display: "block",
                margin: "4px 0",
                padding: "6px 10px",
                width: "100%",
                cursor: "pointer",
                borderRadius: 6,
                border: "none",
                background: f === floor ? "#007AFF" : "#eee",
                color: f === floor ? "#fff" : "#000",
                fontWeight: f === floor ? "bold" : "normal",
              }}
            >
              Floor {f}
            </button>
          ))}
        </div>
      )}

      {/* MAP CONTAINER */}
      <div ref={containerRef} style={{ height: "100%" }} />
    </>
  );
}
