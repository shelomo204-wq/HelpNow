import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./App.css";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const categories = [
  {
    id: "car",
    name: "רכב",
    icon: "🚗",
    color: "blue",
  },
  {
    id: "repairs",
    name: "תיקונים",
    icon: "🔧",
    color: "purple",
  },
  {
    id: "delivery",
    name: "הובלה",
    icon: "📦",
    color: "orange",
  },
  {
    id: "shopping",
    name: "קניות",
    icon: "🛒",
    color: "green",
  },
  {
    id: "assembly",
    name: "הרכבה",
    icon: "🪑",
    color: "teal",
  },
  {
    id: "pets",
    name: "חיות מחמד",
    icon: "🐾",
    color: "pink",
  },
];

const initialRequests = [
  {
    id: 1,
    title: "צריך עזרה בהעברת ארון",
    description:
      "צריך להעביר ארון קטן מהבית לרכב.",
    category: "delivery",
    price: 80,
    location: "ראשון לציון",
    position: [31.973, 34.7925],
    status: "open",
  },
  {
    id: 2,
    title: "עזרה בהרכבת שולחן",
    description:
      "שולחן חדש הגיע ואני צריך עזרה בהרכבה.",
    category: "assembly",
    price: 100,
    location: "ראשון לציון",
    position: [31.968, 34.787],
    status: "open",
  },
  {
    id: 3,
    title: "צריך לקנות כמה דברים",
    description:
      "צריך מישהו שיקפוץ לסופר ויביא כמה דברים.",
    category: "shopping",
    price: 60,
    location: "ראשון לציון",
    position: [31.977, 34.8],
    status: "open",
  },
];

function RecenterMap({ position, trigger }) {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }

    map.flyTo(position, 14, {
      duration: 1,
    });
  }, [position, trigger, map]);

  return null;
}

function distanceBetween(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

function distanceText(distance) {
  if (distance < 1) {
    const meters = Math.round(
      distance * 1000
    );

    return meters + " מ׳";
  }

  const kilometers = distance.toFixed(1);

  return kilometers + " ק״מ";
}

function App() {
  const [userPosition, setUserPosition] =
    useState(null);

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [locationError, setLocationError] =
    useState("");

  const [mapTrigger, setMapTrigger] =
    useState(0);

  const [showForm, setShowForm] =
    useState(false);

  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [showChat, setShowChat] =
    useState(false);

  const [description, setDescription] =
    useState("");

  const [price, setPrice] =
    useState("");

  const [category, setCategory] =
    useState("delivery");

  const [filter, setFilter] =
    useState("all");

  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [requests, setRequests] =
    useState(initialRequests);

  const [socket, setSocket] =
    useState(null);

  const [socketConnected, setSocketConnected] =
    useState(false);

  const [userId] = useState(() => {
    const saved =
      localStorage.getItem(
        "helpnow_user_id"
      );

    if (saved) {
      return saved;
    }

    const newId =
      "user_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 9);

    localStorage.setItem(
      "helpnow_user_id",
      newId
    );

    return newId;
  });

  /*
   * חיבור לשרת הצ'אט
   */
  useEffect(() => {
    if (
      !selectedRequest ||
      !showChat
    ) {
      return;
    }

    console.log(
      "🔌 מתחבר לצ'אט של משימה:",
      selectedRequest.id
    );

    const ws = new WebSocket(
      "ws://127.0.0.1:3001"
    );

    ws.onopen = () => {
      console.log(
        "🟢 מחובר לשרת הצ'אט"
      );

      setSocketConnected(true);

      ws.send(
        JSON.stringify({
          type: "join",
          roomId: selectedRequest.id,
          userId,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(
          event.data
        );

        console.log(
          "📩 התקבלה מהשרת:",
          data
        );

        /*
         * קבלת היסטוריית הצ'אט
         */
        if (
          data.type === "history"
        ) {
          if (
            String(data.roomId) !==
            String(selectedRequest.id)
          ) {
            return;
          }

          const history =
            Array.isArray(data.messages)
              ? data.messages
              : [];

          console.log(
            "📚 היסטוריית הצ'אט:",
            history
          );

          setMessages(
            history.map((item) => ({
              id:
                item.id ||
                Date.now() +
                  Math.random(),

              sender:
                String(
                  item.senderId
                ) === String(userId)
                  ? "me"
                  : "other",

              text: String(
                item.text || ""
              ),
            }))
          );

          return;
        }

        /*
         * הודעה חדשה
         */
        if (
          data.type === "chat"
        ) {
          if (
            String(data.roomId) !==
            String(selectedRequest.id)
          ) {
            return;
          }

          setMessages(
            (current) => {
              /*
               * מונע כפילות של הודעות
               */
              const alreadyExists =
                current.some(
                  (item) =>
                    String(
                      item.id
                    ) ===
                    String(data.id)
                );

              if (alreadyExists) {
                return current;
              }

              return [
                ...current,
                {
                  id:
                    data.id ||
                    Date.now() +
                      Math.random(),

                  sender:
                    String(
                      data.senderId
                    ) ===
                    String(userId)
                      ? "me"
                      : "other",

                  text: String(
                    data.text || ""
                  ),
                },
              ];
            }
          );
        }
      } catch (error) {
        console.error(
          "❌ שגיאה בקבלת הודעה:",
          error
        );
      }
    };

    ws.onclose = () => {
      console.log(
        "🔴 החיבור לצ'אט נסגר"
      );

      setSocketConnected(false);
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error(
        "❌ שגיאת WebSocket:",
        error
      );

      setSocketConnected(false);
    };

    setSocket(ws);

    return () => {
      ws.close();
      setSocket(null);
      setSocketConnected(false);
    };
  }, [
    selectedRequest,
    showChat,
    userId,
  ]);

  /*
   * מציאת מיקום
   */
  function findLocation() {
    if (
      !navigator.geolocation
    ) {
      setLocationError(
        "הדפדפן לא תומך במיקום"
      );

      return;
    }

    setLocationLoading(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        setUserPosition(coords);

        setMapTrigger(
          (value) => value + 1
        );

        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);

        setLocationError(
          "לא הצלחנו לקבל את המיקום שלך"
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  /*
   * חישוב מרחקים
   */
  const requestsWithDistance =
    useMemo(() => {
      const result =
        requests
          .filter(
            (request) =>
              request.status ===
              "open"
          )
          .map((request) => {
            let distance = null;

            if (userPosition) {
              distance =
                distanceBetween(
                  userPosition[0],
                  userPosition[1],
                  request.position[0],
                  request.position[1]
                );
            }

            return {
              ...request,
              distance,
            };
          })
          .sort((a, b) => {
            if (
              a.distance === null ||
              b.distance === null
            ) {
              return 0;
            }

            return (
              a.distance -
              b.distance
            );
          });

      return result;
    }, [
      requests,
      userPosition,
    ]);

  const filteredRequests =
    useMemo(() => {
      if (filter === "all") {
        return requestsWithDistance;
      }

      return requestsWithDistance.filter(
        (request) =>
          request.category ===
          filter
      );
    }, [
      filter,
      requestsWithDistance,
    ]);

  /*
   * פרסום משימה
   */
  function publishRequest(event) {
    event.preventDefault();

    if (
      !description.trim() ||
      !price ||
      !category
    ) {
      return;
    }

    const basePosition =
      userPosition || [
        31.973,
        34.7925,
      ];

    const newRequest = {
      id: Date.now(),
      title:
        description.trim(),
      description:
        description.trim(),
      category,
      price: Number(price),
      location: "המיקום שלי",
      position: basePosition,
      status: "open",
    };

    setRequests(
      (current) => [
        newRequest,
        ...current,
      ]
    );

    setDescription("");
    setPrice("");
    setCategory("delivery");
    setShowForm(false);
  }

  /*
   * לקיחת משימה
   */
  function takeRequest(request) {
    const updated = {
      ...request,
      status: "taken",
    };

    setRequests(
      (current) =>
        current.map((item) =>
          item.id === request.id
            ? updated
            : item
        )
    );

    setSelectedRequest(
      updated
    );
  }

  /*
   * ביטול משימה
   */
  function cancelRequest() {
    if (!selectedRequest) {
      return;
    }

    setRequests(
      (current) =>
        current.map((item) =>
          item.id ===
          selectedRequest.id
            ? {
                ...item,
                status:
                  "open",
              }
            : item
        )
    );

    setSelectedRequest(null);
  }

  /*
   * פתיחת צ'אט
   */
  function openChat(request) {
    setSelectedRequest(request);
    setMessages([]);
    setShowChat(true);
  }

  /*
   * שליחת הודעה
   */
  function sendMessage(event) {
    event.preventDefault();

    const text =
      message.trim();

    if (!text) {
      return;
    }

    if (
      socket &&
      socket.readyState ===
        WebSocket.OPEN
    ) {
      socket.send(
        JSON.stringify({
          type: "chat",
          roomId:
            selectedRequest.id,
          senderId:
            userId,
          text,
        })
      );

      setMessage("");

      return;
    }

    console.log(
      "⚠️ אין חיבור לשרת הצ'אט"
    );
  }

  function getCategory(
    categoryId
  ) {
    return (
      categories.find(
        (item) =>
          item.id === categoryId
      ) ||
      categories[0]
    );
  }

  return (
    <div
      className="app"
      dir="rtl"
    >
      <header className="header">
        <div className="brand">
          <div className="brandIcon">
            🤝
          </div>

          <div>
            <div className="logo">
              HelpNow
            </div>

            <div className="subtitle">
              עוזרים. מתחברים.
              מרוויחים.
            </div>
          </div>
        </div>

        <button className="loginButton">
          כניסה
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="heroText">
            <div className="badge">
              ⚡ עזרה קרובה אליך
            </div>

            <h1>
              צריכים עזרה?
              <br />
              <span>
                מישהו קרוב יכול לעזור.
              </span>
            </h1>

            <p>
              משימות קטנות,
              אנשים אמיתיים,
              עזרה שמגיעה עד אליך.
            </p>

            <div className="heroActions">
              <button
                className="primaryAction"
                onClick={() =>
                  setShowForm(true)
                }
              >
                <span className="actionIcon">
                  +
                </span>

                פרסום משימה

                <span className="actionArrow">
                  ←
                </span>
              </button>

              <button
                className="secondaryAction"
                onClick={
                  findLocation
                }
              >
                📍 מצא עזרה לידי
              </button>
            </div>

            {locationLoading && (
              <div className="locationMessage">
                מחפש את המיקום שלך...
              </div>
            )}

            {locationError && (
              <div className="locationMessage locationBad">
                {locationError}
              </div>
            )}

            {userPosition && (
              <div className="locationMessage locationGood">
                ✓ המיקום שלך נמצא
              </div>
            )}
          </div>

          <div className="mapCard">
            <div className="mapHeader">
              <h3>
                עזרה בסביבה שלך
              </h3>

              <span>
                {filteredRequests.length}{" "}
                משימות
              </span>
            </div>

            <div className="mapBox">
              <MapContainer
                center={
                  userPosition || [
                    31.973,
                    34.7925,
                  ]
                }
                zoom={13}
                scrollWheelZoom={true}
                style={{
                  height: "100%",
                  width: "100%",
                }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <RecenterMap
                  position={
                    userPosition
                  }
                  trigger={
                    mapTrigger
                  }
                />

                {filteredRequests.map(
                  (request) => (
                    <Marker
                      key={
                        request.id
                      }
                      position={
                        request.position
                      }
                    />
                  )
                )}

                {userPosition && (
                  <Marker
                    position={
                      userPosition
                    }
                  />
                )}
              </MapContainer>

              <div className="mapLocation">
                <span>
                  📍
                </span>

                <div>
                  <strong>
                    {userPosition
                      ? "המיקום שלך"
                      : "ראשון לציון"}
                  </strong>

                  <small>
                    {userPosition
                      ? "מיקום נוכחי"
                      : "אזור משוער"}
                  </small>
                </div>
              </div>
            </div>

            <div className="mapFooter">
              <div>
                <span className="onlineDot" />

                <span>
                  אנשים פעילים עכשיו
                </span>
              </div>

              <div>
                <strong>
                  {filteredRequests.length}
                </strong>

                <small>
                  משימות פתוחות
                </small>
              </div>
            </div>
          </div>
        </section>

        <section className="contentSection">
          <div className="sectionHeader">
            <div>
              <h2>
                מה צריך?
              </h2>

              <p>
                בחרו קטגוריה
              </p>
            </div>

            <button
              className={
                "allButton " +
                (filter === "all"
                  ? "selected"
                  : "")
              }
              onClick={() =>
                setFilter("all")
              }
            >
              הכל
            </button>
          </div>

          <div className="categoryGrid">
            {categories.map(
              (item) => (
                <button
                  key={item.id}
                  className={
                    "category " +
                    item.color +
                    (filter ===
                    item.id
                      ? " active"
                      : "")
                  }
                  onClick={() =>
                    setFilter(
                      item.id
                    )
                  }
                >
                  <div className="categoryIcon">
                    {item.icon}
                  </div>

                  <span>
                    {item.name}
                  </span>
                </button>
              )
            )}
          </div>
        </section>

        <section className="contentSection">
          <div className="sectionHeader">
            <div>
              <h2>
                משימות קרובות
              </h2>

              <p>
                אנשים שמחכים לעזרה
              </p>
            </div>

            <button
              className="allButton"
              onClick={() =>
                setFilter("all")
              }
            >
              הצג הכל
            </button>
          </div>

          <div className="requestList">
            {filteredRequests.length ===
            0 ? (
              <div className="empty">
                <strong>
                  אין כרגע משימות
                </strong>

                <span>
                  נסו לבחור קטגוריה
                  אחרת
                </span>
              </div>
            ) : (
              filteredRequests.map(
                (request) => {
                  const cat =
                    getCategory(
                      request.category
                    );

                  return (
                    <div
                      className="request"
                      key={
                        request.id
                      }
                    >
                      <div
                        className={
                          "requestIcon " +
                          cat.color
                        }
                      >
                        {cat.icon}
                      </div>

                      <div className="requestMain">
                        <h3>
                          {
                            request.title
                          }
                        </h3>

                        <div className="requestMeta">
                          <span>
                            📍{" "}
                            {
                              request.location
                            }
                          </span>

                          {request.distance !==
                            null &&
                            request.distance !==
                              undefined && (
                              <span>
                                📏{" "}
                                {distanceText(
                                  request.distance
                                )}
                              </span>
                            )}
                        </div>
                      </div>

                      <div className="price">
                        <strong>
                          ₪
                          {
                            request.price
                          }
                        </strong>

                        <span>
                          תשלום
                        </span>
                      </div>

                      <button
                        className="helpButton"
                        onClick={() =>
                          takeRequest(
                            request
                          )
                        }
                      >
                        <span>
                          אני עוזר
                        </span>

                        <span>
                          →
                        </span>
                      </button>
                    </div>
                  );
                }
              )
            )}
          </div>
        </section>
      </main>

      {showForm && (
        <div className="overlay">
          <div className="modal">
            <button
              className="close"
              onClick={() =>
                setShowForm(false)
              }
            >
              ×
            </button>

            <div className="modalHeading">
              <div className="modalEmoji">
                🤝
              </div>

              <div>
                <h2>
                  פרסום משימה
                </h2>

                <p>
                  מה אתם צריכים?
                </p>
              </div>
            </div>

            <form
              onSubmit={
                publishRequest
              }
            >
              <label>
                תיאור המשימה
              </label>

              <textarea
                value={
                  description
                }
                onChange={(event) =>
                  setDescription(
                    event.target
                      .value
                  )
                }
                placeholder="לדוגמה: צריך עזרה בהרכבת ארון"
              />

              <label>
                קטגוריה
              </label>

              <div className="modalCategories">
                {categories.map(
                  (item) => (
                    <button
                      type="button"
                      key={
                        item.id
                      }
                      className={
                        "modalCategory " +
                        (category ===
                        item.id
                          ? "active"
                          : "")
                      }
                      onClick={() =>
                        setCategory(
                          item.id
                        )
                      }
                    >
                      <span>
                        {
                          item.icon
                        }
                      </span>

                      {
                        item.name
                      }
                    </button>
                  )
                )}
              </div>

              <label>
                כמה תשלמו?
              </label>

              <div className="priceInput">
                <span>
                  ₪
                </span>

                <input
                  type="number"
                  min="1"
                  value={price}
                  onChange={(event) =>
                    setPrice(
                      event.target
                        .value
                    )
                  }
                  placeholder="100"
                />
              </div>

              <button
                className="publish"
                type="submit"
              >
                פרסם משימה
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedRequest &&
        !showChat && (
          <div className="overlay">
            <div className="modal helpModal">
              <button
                className="close"
                onClick={() =>
                  setSelectedRequest(
                    null
                  )
                }
              >
                ×
              </button>

              <div
                className={
                  "bigRequestIcon " +
                  getCategory(
                    selectedRequest.category
                  ).color
                }
              >
                {
                  getCategory(
                    selectedRequest.category
                  ).icon
                }
              </div>

              <div className="openStatus">
                ✓ המשימה נלקחה
              </div>

              <h2>
                {
                  selectedRequest.title
                }
              </h2>

              <p className="helpText">
                {
                  selectedRequest.description
                }
              </p>

              <div className="details">
                <div>
                  <span>
                    📍
                  </span>

                  <small>
                    מיקום
                  </small>

                  <strong>
                    {
                      selectedRequest.location
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    💰
                  </span>

                  <small>
                    תשלום
                  </small>

                  <strong>
                    ₪
                    {
                      selectedRequest.price
                    }
                  </strong>
                </div>
              </div>

              <button
                className="takeButton"
                onClick={() =>
                  openChat(
                    selectedRequest
                  )
                }
              >
                💬 פתח צ'אט
              </button>

              <button
                className="cancelTaskButton"
                onClick={
                  cancelRequest
                }
              >
                ביטול המשימה
              </button>

              <div className="privacy">
                🔒 הפרטים שלך
                נשארים פרטיים
              </div>
            </div>
          </div>
        )}

      {selectedRequest &&
        showChat && (
          <div className="overlay">
            <div className="modal chatModal">
              <div className="chatHeader">
                <div className="chatAvatar">
                  {
                    getCategory(
                      selectedRequest.category
                    ).icon
                  }
                </div>

                <div>
                  <strong>
                    {
                      selectedRequest.title
                    }
                  </strong>

                  <small>
                    {socketConnected
                      ? "מחובר לצ'אט"
                      : "מתחבר לצ'אט..."}
                  </small>
                </div>

                <button
                  className="close"
                  onClick={() => {
                    setShowChat(false);
                  }}
                >
                  ×
                </button>
              </div>

              <div className="messages">
                {messages.length ===
                0 ? (
                  <div className="empty">
                    <strong>
                      אין עדיין הודעות
                    </strong>

                    <span>
                      התחילו את השיחה
                    </span>
                  </div>
                ) : (
                  messages.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className={
                          "message " +
                          item.sender
                        }
                      >
                        {item.text}
                      </div>
                    )
                  )
                )}
              </div>

              <form
                className="chatInput"
                onSubmit={
                  sendMessage
                }
              >
                <input
                  value={message}
                  onChange={(
                    event
                  ) =>
                    setMessage(
                      event.target
                        .value
                    )
                  }
                  placeholder="כתבו הודעה..."
                />

                <button
                  type="submit"
                >
                  ➤
                </button>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}

export default App;