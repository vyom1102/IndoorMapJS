import { useState } from "react";
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

// Mobile-specific result panel style
const getResultPanelStyle = () => {
  if (typeof window !== "undefined" && window.innerWidth <= 768) {
    return {
      ...resultPanelStyle,
      maxHeight: 150,
      marginTop: 4,
    };
  }
  return resultPanelStyle;
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


function CategoryIcon({ category, size = 32, style = {} }) {
  // const path = CATEGORY_ICON_PATHS[category.name];
   const path = category.icon;   
  if (path) {
    return (
      <img
        src={path}
        alt={category.label}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          ...style,
        }}
      />
    );
  }
    return <span style={{ fontSize: size * 0.75, lineHeight: 1, ...style }}>{path}</span>;

}

function SearchResults({ results, onSelect }) {
  if (!results.length) return null;

  return (
    <div style={getResultPanelStyle()}>
      {results.map((item, i) => (
        <button
          key={`${item.matchedText}-${i}`}
          onClick={() => onSelect(item)}
          style={{
            width: "100%",
            padding: "10px 12px",
            cursor: "pointer",
            border: "none",
            borderBottom:
              i !== results.length - 1 ? "1px solid #eef1f6" : "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "#fff",
            textAlign: "left",
            fontSize: typeof window !== "undefined" && window.innerWidth <= 768 ? "12px" : "14px",
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
    <div className="route-steps-panel-container">
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

function TappedObjectPanel({ name, onGetDirections, onClose }) {
  return (
    <div className="directions-panel-container">
      <div
        style={{
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
            alignItems: "center",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid #eef1f6",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#edf3ff",
              color: "#2f57d6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            ◉
          </div>
          <div
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: 800,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              border: "none",
              borderRadius: 8,
              background: "#f3f5f9",
              color: "#6b7280",
              fontSize: 18,
              cursor: "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "14px 18px 18px" }}>
          <button
            type="button"
            onClick={onGetDirections}
            style={{
              width: "100%",
              height: 42,
              borderRadius: 8,
              border: "none",
              background: "#2f57d6",
              color: "#fff",
              fontWeight: 900,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 10px 22px rgba(47, 87, 214, 0.28)",
            }}
          >
            Get Directions
          </button>
        </div>
      </div>
    </div>
  );
}

function ParkingPanel({ parking, onGetDirections, onDelete, onClose }) {
  return (
    <div className="directions-panel-container">
      <div
        style={{
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
            alignItems: "center",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid #eef1f6",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#edf3ff",
              color: "#2f57d6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            🚗
          </div>
          <div
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: 800,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {parking ? "My Parking" : "Parking"}
            <div style={{ fontSize: 12, color: "#667085", marginTop: 4 }}>{parking?.floorLabel || ""}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              border: "none",
              borderRadius: 8,
              background: "#f3f5f9",
              color: "#6b7280",
              fontSize: 18,
              cursor: "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "14px 18px 18px", display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onGetDirections}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 8,
              border: "none",
              background: "#2f57d6",
              color: "#fff",
              fontWeight: 900,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 10px 22px rgba(47, 87, 214, 0.28)",
            }}
          >
            Get Directions
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{
              flex: 0,
              height: 42,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#dc3545",
              fontWeight: 800,
              padding: "0 12px",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryFilterPanel({
  categories,
  selectedCategories,
  onCategoryToggle,
  onSearch,
  destResults,
  onDestSelect,
  onClearFilter,
  parking,
  onStartMarkParking,
  markingParking,
  onSetParkingAsDest,
  onShowParkingPanel,
}) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const hasActiveFilter = selectedCategories.length > 0;
  const isDesktopView =
    typeof window !== "undefined" && window.innerWidth > 768;
  const activeCategory = hasActiveFilter
    ? categories.find((c) => c.name === selectedCategories[0])
    : null;

  const handleSearchChange = (val) => {
    setSearchValue(val);
    onSearch(val);
  };

  const commitRecentSearch = (val) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)];
      return next.slice(0, 6);
    });
  };

  const closeExpanded = () => {
    setSearchExpanded(false);
  };

  const handleCategoryTap = (cat) => {
    onCategoryToggle(cat);
    closeExpanded();
  };

  const handleResultTap = (result) => {
    commitRecentSearch(searchValue);
    onDestSelect(result);
    closeExpanded();
  };

  const handleRecentTap = (term) => {
    setSearchValue(term);
    onSearch(term);
  };

  const removeRecent = (term) => {
    setRecentSearches((prev) => prev.filter((s) => s !== term));
  };

  return (
    <>
      {/* ── DESKTOP (unchanged) ── */}
      {isDesktopView && desktopCollapsed ? (
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            zIndex: 20,
            width: "360px",
            maxWidth: "calc(100vw - 36px)",
          }}
        >
          <div
            style={{
              background: "#1a1a1a",
              borderRadius: 12,
              boxShadow: "0 18px 48px rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              padding: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <input
                type="text"
                placeholder="🔍 Search for a point of interest"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  flex: 1,
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setDesktopCollapsed(false)}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  minWidth: 120,
                }}
              >
                Show filters
              </button>
            </div>
            {destResults && destResults.length > 0 && (
              <SearchResults results={destResults} onSelect={handleResultTap} />
            )}
          </div>
        </div>
      ) : (
        <div className="poi-panel-desktop directions-panel-container">
          <div
            style={{
              background: "#1a1a1a",
              borderRadius: 12,
              boxShadow: "0 18px 48px rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              overflow: "hidden",
              padding: "18px",
            }}
          >
            {isDesktopView && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <input
                  type="text"
                  placeholder="🔍 Search for a point of interest"
                  onChange={(e) => onSearch(e.target.value)}
                  style={{
                    flex: 1,
                    height: 48,
                    padding: "0 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setDesktopCollapsed(true)}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 16px",
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    minWidth: 120,
                  }}
                >
                  Collapse filters
                </button>
              </div>
            )}
            {!isDesktopView && (
              <input
                type="text"
                placeholder="🔍 Search for a point of interest"
                onChange={(e) => onSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                  marginBottom: 16,
                  boxSizing: "border-box",
                }}
              />
            )}

          {hasActiveFilter && activeCategory ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(47, 87, 214, 0.25)",
                border: "1.5px solid #2f57d6",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "rgba(47, 87, 214, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CategoryIcon category={activeCategory} size={22} />
              </div>
              <span style={{ flex: 1, color: "#fff", fontSize: 14, fontWeight: 700 }}>
                {activeCategory.label}
              </span>
              <button
                onClick={onClearFilter}
                aria-label="Clear filter"
                style={{
                  width: 28,
                  height: 28,
                  border: "none",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 16,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                maxHeight: 320,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {/* My Parking button as first category */}
              <div>
                <button
                  onClick={() => {
                    if (parking && parking.coord) {
                      onShowParkingPanel && onShowParkingPanel(true);
                    } else {
                      onStartMarkParking && onStartMarkParking();
                    }
                    onClearFilter && onClearFilter();
                  }}
                  style={{
                    padding: "12px 10px",
                    borderRadius: 12,
                    border: "1px solid transparent",
                    background: parking ? "rgba(47, 87, 214, 0.3)" : "rgba(255, 255, 255, 0.08)",
                    color: parking ? "#fff" : "rgba(255, 255, 255, 0.7)",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: parking ? "rgba(47, 87, 214, 0.4)" : "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    🚗
                  </div>
                  <span style={{ lineHeight: 1.2, wordBreak: "break-word" }}>{parking ? "My Parking" : "Mark Parking"}</span>
                </button>
                {markingParking && (
                  <div style={{ marginTop: 8, color: "#fff", fontSize: 13 }}>
                    Click anywhere on the map to mark your parking spot
                  </div>
                )}
              </div>

              {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.name);
                return (
                  <button
                    key={cat.name}
                    onClick={() => onCategoryToggle(cat)}
                    style={{
                      padding: "12px 10px",
                      borderRadius: 12,
                      border: isSelected ? "2px solid #2f57d6" : "1px solid transparent",
                      background: isSelected ? "rgba(47, 87, 214, 0.3)" : "rgba(255, 255, 255, 0.08)",
                      color: isSelected ? "#fff" : "rgba(255, 255, 255, 0.7)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: isSelected ? "rgba(47, 87, 214, 0.4)" : "rgba(255,255,255,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CategoryIcon category={cat} size={22} />
                    </div>
                    <span style={{ lineHeight: 1.2, wordBreak: "break-word" }}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {destResults && destResults.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255, 255, 255, 0.5)", marginBottom: 8 }}>
                Search Results
              </div>
              <div style={{ display: "grid", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                {destResults.slice(0, 8).map((result, i) => (
                  <button
                    key={`${result.matchedText}-${i}`}
                    onClick={() => onDestSelect(result)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 13,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; }}
                  >
                    <div style={{ fontWeight: 600 }}>{result.matchedText}</div>
                    {result.actualName !== result.matchedText && (
                      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{result.actualName}</div>
                    )}
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{result.floorLabel}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      {/* ── MOBILE: collapsed floating bar + peeking bottom sheet ── */}
      {!searchExpanded && (
        <div className="poi-mobile-collapsed">
          <button
            type="button"
            className="poi-mobile-searchbar"
            onClick={() => setSearchExpanded(true)}
          >
            <span className="poi-mobile-searchbar-icon">🔍</span>
            <span className="poi-mobile-searchbar-placeholder">
              {searchValue || "Search for a point of interest"}
            </span>
            <span
              className="poi-mobile-searchbar-list"
              role="button"
              aria-label="Open categories"
              onClick={(e) => {
                e.stopPropagation();
                setSearchExpanded(true);
              }}
            >
              ☰
            </span>
          </button>

          <div className="poi-mobile-sheet">
            <div className="poi-mobile-sheet-handle" />
            <div className="poi-mobile-sheet-row">
                {/* My Parking chip */}
                <button
                  className="poi-mobile-chip"
                  onClick={() => {
                    if (parking && parking.coord) {
                      onShowParkingPanel && onShowParkingPanel(true);
                    } else {
                      onStartMarkParking && onStartMarkParking();
                    }
                  }}
                >
                  <div
                    className="poi-mobile-chip-icon"
                    style={{ background: parking ? "#2f57d6" : undefined }}
                  >
                    🚗
                  </div>
                  <span className="poi-mobile-chip-label">{parking ? "My Parking" : "Mark Parking"}</span>
                </button>

                {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.name);
                return (
                  <button
                    key={cat.name}
                    className="poi-mobile-chip"
                    onClick={() => onCategoryToggle(cat)}
                  >
                    <div
                      className="poi-mobile-chip-icon"
                      style={{
                        background: isSelected ? "#2f57d6" : undefined,
                      }}
                    >
                      <CategoryIcon category={cat} size={26} />
                    </div>
                    <span className="poi-mobile-chip-label">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE: expanded full-page search (opaque, map hidden) ── */}
      {searchExpanded && (
        <div className="poi-mobile-expanded poi-mobile-expanded--solid">
          <div className="poi-mobile-expanded-header">
            <button
              type="button"
              className="poi-mobile-back"
              onClick={closeExpanded}
              aria-label="Back"
            >
              ‹
            </button>
            <input
              autoFocus
              type="text"
              className="poi-mobile-expanded-input"
              placeholder="Search for a point of interest"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRecentSearch(searchValue);
              }}
            />
            <button
              type="button"
              className="poi-mobile-maptoggle"
              onClick={closeExpanded}
              aria-label="Back to map"
            >
              🗺
            </button>
          </div>

          {recentSearches.length > 0 && !searchValue && (
            <div className="poi-mobile-recents">
              {recentSearches.map((term) => (
                <div key={term} className="poi-mobile-recent-row">
                  <button
                    type="button"
                    className="poi-mobile-recent-text"
                    onClick={() => handleRecentTap(term)}
                  >
                    <span className="poi-mobile-recent-clock">🕐</span>
                    {term}
                  </button>
                  <button
                    type="button"
                    className="poi-mobile-recent-clear"
                    onClick={() => removeRecent(term)}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {!searchValue && (
            <div className="poi-mobile-grid">
              <button
                className="poi-mobile-grid-item"
                onClick={() => {
                  if (parking && parking.coord) {
                    onShowParkingPanel && onShowParkingPanel(true);
                  } else {
                    onStartMarkParking && onStartMarkParking();
                  }
                }}
              >
                <div className="poi-mobile-grid-icon" style={{ background: parking ? "#2f57d6" : "rgba(255,255,255,0.08)" }}>
                  🚗
                </div>
                <span className="poi-mobile-grid-label">{parking ? "My Parking" : "Mark Parking"}</span>
              </button>

              {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.name);
                return (
                  <button
                    key={cat.name}
                    className="poi-mobile-grid-item"
                    onClick={() => handleCategoryTap(cat)}
                  >
                    <div
                      className="poi-mobile-grid-icon"
                      style={{ background: isSelected ? "#2f57d6" : undefined }}
                    >
                      <CategoryIcon category={cat} size={26} />
                    </div>
                    <span className="poi-mobile-grid-label">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {searchValue && destResults && destResults.length > 0 && (
            <div className="poi-mobile-results">
              {destResults.slice(0, 12).map((result, i) => (
                <button
                  key={`${result.matchedText}-${i}`}
                  className="poi-mobile-result-row"
                  onClick={() => handleResultTap(result)}
                >
                  <div className="poi-mobile-result-name">{result.matchedText}</div>
                  {result.actualName !== result.matchedText && (
                    <div className="poi-mobile-result-sub">{result.actualName}</div>
                  )}
                  <div className="poi-mobile-result-floor">{result.floorLabel}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}


export default function IndoorMapUI({
  sourceQuery,
  destQuery,
  sourceResults,
  destResults,
  destSelected,
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
  tappedFeature,
  onSetTappedAsDest,
  onCloseTappedPanel,
  poiCategories,
  selectedCategories,
  onCategoryToggle,
  onClearFilter,
  parking,
  markingParking,
  onStartMarkParking,
  onStopMarkParking,
  onSetParkingAsDest,
  onDeleteParking,
}) {
  const hasRoute = routeSummary?.hasRoute;
  const isNavigating = routeSummary?.isNavigating;
  const showStepsPreview = routeSummary?.showStepsPreview;
  const hasTappedFeature = !!tappedFeature && !isNavigating && !showStepsPreview;
const [showFloors, setShowFloors] = useState(false);
  const [showParkingPanel, setShowParkingPanel] = useState(false);
  return (
    <>
      <style>
        {`
          @keyframes routePulse {
            0% { transform: scale(0.8); opacity: 0.9; }
            100% { transform: scale(1.9); opacity: 0; }
          }

          /* Desktop styles */
          .directions-panel-container {
            position: absolute;
            top: 18px;
            left: 18px;
            z-index: 20;
            width: 360px;
            max-width: calc(100vw - 36px);
          }

          .navigation-panel-container {
            position: absolute;
            top: 18px;
            left: 18px;
            z-index: 22;
            width: 360px;
            max-width: calc(100vw - 36px);
          }

          .route-steps-panel-container {
            position: absolute;
            top: 18px;
            left: 18px;
            bottom: 18px;
            z-index: 24;
            width: 380px;
            max-width: calc(100vw - 36px);
            display: flex;
            flex-direction: column;
          }

          .floor-selector-container {
            position: absolute;
            top: 18px;
            right: 18px;
            z-index: 18;
            display: grid;
            gap: 8px;
          }

          /* Tablet and mobile (≤768px) */
          @media (max-width: 768px) {
            .directions-panel-container {
              top: 8px !important;
              left: 8px !important;
              right: 8px !important;
              width: auto !important;
              max-width: none !important;
            }

            .navigation-panel-container {
              top: 8px !important;
              left: 8px !important;
              right: 8px !important;
              width: auto !important;
              max-width: none !important;
            }

            .route-steps-panel-container {
              top: 8px !important;
              left: 8px !important;
              right: 8px !important;
              bottom: 8px !important;
              width: auto !important;
              max-width: none !important;
            }

            .floor-selector-container {
              bottom: 200px !important;   /* keep floor selector above parking button on mobile */
              right: 8px !important;
              top: auto !important;
              gap: 4px !important;
            }

            .floor-selector-container > div {
              padding: 3px !important;
              gap: 2px !important;
            }

            .floor-selector-container button {
              height: 28px !important;
              min-width: 60px !important;
              font-size: 12px !important;
              padding: 0 8px !important;
            }

            .directions-panel-container > div {
              border-radius: 6px !important;
            }

            .directions-panel-container [style*="padding"] {
              padding: 12px 12px 10px !important;
            }

            .directions-panel-container h2 {
              font-size: 18px !important;
              margin: 0 0 12px !important;
            }

            .directions-panel-container input {
              height: 40px !important;
              font-size: 13px !important;
              padding: 0 10px !important;
            }

            .search-input-container {
              gap: 8px !important;
            }

            .navigation-panel-container > div:first-child {
              padding: 16px 16px !important;
              gap: 12px !important;
            }

            .navigation-panel-container > div:first-child > div:first-child {
              font-size: 40px !important;
            }

            .navigation-panel-container > div:first-child > div:last-child > div:first-child {
              font-size: 22px !important;
            }

            .navigation-panel-container > div:first-child > div:last-child > div:last-child {
              font-size: 13px !important;
            }

            .route-steps-panel-container > div {
              border-radius: 8px !important;
            }

            .route-steps-panel-container h2 {
              font-size: 18px !important;
            }

            .route-steps-panel-container > div > div:nth-child(2) {
              padding: 12px 12px !important;
            }

            .route-steps-panel-container > div > div:nth-child(3) {
              padding: 8px 0 8px !important;
            }

            .route-steps-panel-container > div > div:nth-child(3) > div {
              padding: 10px 12px !important;
              gap: 8px !important;
            }

            .route-steps-panel-container > div > div:nth-child(3) > div > div:nth-child(2) {
              width: 36px !important;
              height: 36px !important;
              font-size: 18px !important;
            }

            .route-steps-panel-container > div > div:nth-child(3) > div > div:nth-child(4) {
              font-size: 11px !important;
            }
          }

          /* Small mobile (≤480px) */
          @media (max-width: 480px) {
            .directions-panel-container {
              top: 6px !important;
              left: 6px !important;
              right: 6px !important;
              width: auto !important;
              max-width: none !important;
            }

            .navigation-panel-container {
              top: 6px !important;
              left: 6px !important;
              right: 6px !important;
              width: auto !important;
              max-width: none !important;
            }

            .route-steps-panel-container {
              top: 6px !important;
              left: 6px !important;
              right: 6px !important;
              bottom: 6px !important;
              width: auto !important;
              max-width: none !important;
            }

            .floor-selector-container {
              bottom: 220px !important; /* small phones: keep floor selector higher */
              right: 6px !important;
              gap: 3px !important;
            }

            .floor-selector-container > div {
              padding: 2px !important;
              gap: 1px !important;
            }

            .floor-selector-container button {
              height: 24px !important;
              min-width: 50px !important;
              font-size: 11px !important;
              padding: 0 6px !important;
            }
          }
            /* ── POI panel: desktop visible by default, mobile hidden by default ── */
          .poi-panel-desktop {
            display: block;
          }
          .poi-mobile-collapsed,
          .poi-mobile-expanded {
            display: none;
          }

          @media (max-width: 768px) {
            .poi-panel-desktop {
              display: none !important;
            }

            /* Floating pill search bar */
            .poi-mobile-collapsed {
              display: block !important;
            }

            .poi-mobile-searchbar {
              position: absolute;
              top: 10px;
              left: 10px;
              right: 10px;
              z-index: 20;
              height: 46px;
              border-radius: 24px;
              border: none;
              background: #1f2937;
              color: #fff;
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 0 14px;
              box-shadow: 0 10px 28px rgba(0,0,0,0.28);
              cursor: pointer;
            }

            .poi-mobile-searchbar-icon {
              font-size: 16px;
              opacity: 0.8;
              flex-shrink: 0;
            }

            .poi-mobile-searchbar-placeholder {
              flex: 1;
              text-align: left;
              font-size: 14px;
              color: rgba(255,255,255,0.65);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .poi-mobile-searchbar-list {
              font-size: 18px;
              flex-shrink: 0;
              padding: 4px;
            }

            /* Bottom sheet peeking with one row of categories */
            .poi-mobile-sheet {
              position: absolute;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 19;
              background: #1a1a1a;
              border-top-left-radius: 18px;
              border-top-right-radius: 18px;
              box-shadow: 0 -10px 30px rgba(0,0,0,0.3);
              padding: 8px 0 16px;
            }

            .poi-mobile-sheet-handle {
              width: 40px;
              height: 4px;
              border-radius: 4px;
              background: rgba(255,255,255,0.25);
              margin: 0 auto 10px;
            }

            .poi-mobile-sheet-row {
              display: flex;
              gap: 18px;
              overflow-x: auto;
              padding: 0 18px;
              scroll-snap-type: x proximity;
              -webkit-overflow-scrolling: touch;
            }

            .poi-mobile-sheet-row::-webkit-scrollbar {
              display: none;
            }

            .poi-mobile-chip {
              flex: 0 0 auto;
              scroll-snap-align: start;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 6px;
              border: none;
              background: transparent;
              cursor: pointer;
              min-width: 64px;
            }

            .poi-mobile-chip-icon {
              width: 52px;
              height: 52px;
              border-radius: 50%;
              background: rgba(255,255,255,0.1);
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .poi-mobile-chip-label {
              font-size: 11px;
              font-weight: 600;
              color: rgba(255,255,255,0.85);
              text-align: center;
              line-height: 1.2;
              max-width: 72px;
            }

            /* Expanded full-page search */
            .poi-mobile-expanded {
              display: flex !important;
              flex-direction: column;
              position: absolute;
              inset: 0;
              z-index: 30;
              padding: 10px 10px 16px;
              overflow-y: auto;
            }

            .poi-mobile-expanded--solid {
              background: #1a1a1a;
            }

            .poi-mobile-expanded--translucent {
              background: rgba(10, 10, 10, 0.86);
              backdrop-filter: blur(2px);
            }

            .poi-mobile-expanded-header {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-shrink: 0;
            }

            .poi-mobile-back,
            .poi-mobile-maptoggle {
              width: 38px;
              height: 38px;
              border: none;
              border-radius: 10px;
              background: rgba(255,255,255,0.1);
              color: #fff;
              font-size: 20px;
              flex-shrink: 0;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .poi-mobile-expanded-input {
              flex: 1;
              height: 38px;
              border-radius: 10px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.1);
              color: #fff;
              font-size: 14px;
              padding: 0 12px;
              outline: none;
            }

            .poi-mobile-recents {
              margin-top: 14px;
              flex-shrink: 0;
            }

            .poi-mobile-recent-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 10px 4px;
              border-bottom: 1px solid rgba(255,255,255,0.08);
            }

            .poi-mobile-recent-text {
              flex: 1;
              text-align: left;
              border: none;
              background: transparent;
              color: rgba(255,255,255,0.8);
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 10px;
              cursor: pointer;
            }

            .poi-mobile-recent-clock {
              opacity: 0.6;
              font-size: 13px;
            }

            .poi-mobile-recent-clear {
              border: none;
              background: transparent;
              color: rgba(255,255,255,0.5);
              font-size: 14px;
              cursor: pointer;
              padding: 4px;
            }

            .poi-mobile-grid {
              margin-top: 18px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 14px;
            }

            .poi-mobile-grid-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
              border: none;
              background: transparent;
              cursor: pointer;
              padding: 6px 2px;
            }

            .poi-mobile-grid-icon {
              width: 56px;
              height: 56px;
              border-radius: 14px;
              background: rgba(255,255,255,0.08);
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .poi-mobile-grid-label {
              font-size: 12px;
              font-weight: 600;
              color: rgba(255,255,255,0.85);
              text-align: center;
              line-height: 1.25;
            }

            .poi-mobile-results {
              margin-top: 16px;
              display: grid;
              gap: 6px;
            }

            .poi-mobile-result-row {
              text-align: left;
              border: 1px solid rgba(255,255,255,0.1);
              background: rgba(255,255,255,0.05);
              border-radius: 10px;
              padding: 10px 12px;
              cursor: pointer;
            }

            .poi-mobile-result-name {
              color: #fff;
              font-size: 14px;
              font-weight: 700;
            }

            .poi-mobile-result-sub {
              color: rgba(255,255,255,0.6);
              font-size: 12px;
              margin-top: 2px;
            }

            .poi-mobile-result-floor {
              color: rgba(255,255,255,0.5);
              font-size: 11px;
              margin-top: 4px;
            }
          }
          /* Floating parking button positioning */
          .floating-parking {
            bottom: 100px; /* default fallback */
          }

          @media (max-width: 768px) {
            .floating-parking {
              bottom: 160px !important; /* parking button sits below floor selector */
            }
          }

          @media (max-width: 480px) {
            .floating-parking {
              bottom: 160px !important; /* extra spacing for small phones */
            }
          }
        `}
      </style>

      <div ref={containerRef} style={{ height: "100%" }} />

      {/* Floating Mark Parking button */}
      <div className="floating-parking" style={{ position: "absolute", right: 12, zIndex: 40 }}>
        <button
          type="button"
          onClick={() => {
            if (markingParking) {
              onStopMarkParking && onStopMarkParking();
            } else if (parking && parking.coord) {
              setShowParkingPanel(true);
            } else {
              onStartMarkParking && onStartMarkParking();
            }
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            border: "none",
            background: "#2f57d6",
            color: "#fff",
            fontSize: 22,
            boxShadow: "0 14px 36px rgba(47,87,214,0.28)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label={markingParking ? "Cancel marking" : parking ? "My Parking" : "Mark Parking"}
        >
          🚗
        </button>
        {markingParking && (
          <div style={{ marginTop: 8, textAlign: "center", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "6px 8px", borderRadius: 8, fontSize: 13 }}>
            Click anywhere on the map to mark your parking spot
          </div>
        )}
      </div>

      {showParkingPanel && parking && (
        <ParkingPanel
          parking={parking}
          onGetDirections={() => {
            onSetParkingAsDest && onSetParkingAsDest();
            setShowParkingPanel(false);
          }}
          onDelete={() => {
            onDeleteParking && onDeleteParking();
            setShowParkingPanel(false);
          }}
          onClose={() => setShowParkingPanel(false)}
        />
      )}

      {showStepsPreview && hasRoute && (
        <RouteStepsPanel
          routeSummary={routeSummary}
          onCloseSteps={onCloseSteps}
          onStartNavigation={onStartNavigation}
        />
      )}

      {hasTappedFeature && (
        <TappedObjectPanel
          name={tappedFeature.name}
          onGetDirections={onSetTappedAsDest}
          onClose={onCloseTappedPanel}
        />
      )}

      {!isNavigating && !showStepsPreview && !hasTappedFeature && (
        destSelected ? (
          <div className="directions-panel-container">
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

                <div className="search-input-container" style={{ display: "grid", gap: 10 }}>
                  <div>
                    <input
                      aria-label="Source"
                      placeholder="Choose starting point"
                      value={sourceQuery}
                      onChange={(e) => onSourceSearch(e.target.value)}
                      style={searchInputStyle}
                    />
                    <SearchResults results={sourceResults} onSelect={onSourceSelect} />
                  </div>

                  <div>
                    <input
                      aria-label="Destination"
                      placeholder="Choose destination"
                      value={destQuery}
                      onChange={(e) => onDestSearch(e.target.value)}
                      style={searchInputStyle}
                    />
                    <SearchResults results={destResults} onSelect={onDestSelect} />
                  </div>
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
        ) : (
          showParkingPanel ? null : (
          <CategoryFilterPanel
            categories={poiCategories}
            selectedCategories={selectedCategories}
            onCategoryToggle={onCategoryToggle}
            onSearch={onDestSearch}
            destResults={destResults}
            onDestSelect={onDestSelect}
            onClearFilter={onClearFilter}
            parking={parking}
            markingParking={markingParking}
            onStartMarkParking={onStartMarkParking}
            onStopMarkParking={onStopMarkParking}
            onSetParkingAsDest={onSetParkingAsDest}
            onShowParkingPanel={setShowParkingPanel}
          />
          )
        )
      )}

      {isNavigating && (
        <div className="navigation-panel-container">
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
              {routeSummary.routeSteps?.[routeSummary.currentStep + 1]?.icon || "◎"}
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
                {routeSummary.routeSteps?.[routeSummary.currentStep + 1]?.distance}
              </div>
              <div
                style={{
                  fontSize: 15,
                  marginTop: 4,
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                {routeSummary.routeSteps?.[routeSummary.currentStep + 1]?.instruction}
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
                  Step{" "}
                  {Math.min(routeSummary.currentStep + 1, routeSummary.totalSteps)} of{" "}
                  {routeSummary.totalSteps}
                </div>
              </div>
              <button
                type="button"
                disabled={!routeSummary.canGoBack}
                onClick={onPreviousStep}
                style={routeSummary.canGoBack ? iconButtonStyle : disabledIconButtonStyle}
                aria-label="Previous route step"
              >
                ‹
              </button>
              <button
                type="button"
                disabled={!routeSummary.canGoNext}
                onClick={onNextStep}
                style={routeSummary.canGoNext ? iconButtonStyle : disabledIconButtonStyle}
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
      <div className="floor-selector-container">
        <div
      style={{
        display: "flex",
        flexDirection:
          typeof window !== "undefined" && window.innerWidth <= 768
            ? "column"
            : "column-reverse",
        alignItems: "stretch",
      }}
    >
          {/* Floor list expands upward */}
          {showFloors && (
            <div
            style={{
              display: "flex",
              flexDirection:
                typeof window !== "undefined" && window.innerWidth <= 768
                  ? "column-reverse"   // open upward on mobile
                  : "column",          // open downward on desktop
              gap: 4,
              padding: 6,
              marginBottom:
                typeof window !== "undefined" && window.innerWidth <= 768 ? 6 : 0,
              marginTop:
                typeof window !== "undefined" && window.innerWidth > 768 ? 6 : 0,
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 14px 36px rgba(24, 31, 52, 0.12)",
              border: "1px solid rgba(24, 31, 52, 0.08)",
            }}
          >
              {/* {[...venueData.floors].reverse().map((f) => ( */}
              {(
      typeof window !== "undefined" && window.innerWidth > 768
        ? [...venueData.floors].reverse() // desktop
        : [...venueData.floors]           // mobile
    ).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    onFloorSwitch(f);
                    setShowFloors(false);
                  }}
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
          )}

          {/* Toggle button stays fixed */}
          <button
            onClick={() => setShowFloors((prev) => !prev)}
            style={{
              height: 42,
              minWidth: 88,
              border: "none",
              borderRadius: 12,
              background: "#2f57d6",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 14px 36px rgba(24, 31, 52, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px",
            }}
          >
            <span>{getFloorLabel(floor)}</span>
            <span style={{ fontSize: 12 }}>
              {showFloors ? "▼" : "▲"}
            </span>
          </button>
        </div>
      </div>
    )}
    </>
  );
}