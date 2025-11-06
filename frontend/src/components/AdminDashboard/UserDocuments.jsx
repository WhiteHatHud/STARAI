import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Alert, Card, Skeleton, Collapse, Space, Empty } from "antd";
import useStore from "../../store";
import { DocumentList } from "../global";

const UserDocuments = ({ selectedUser }) => {
  const { token } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cases, setCases] = useState(null); // null = not loaded yet

  const fetchCasesForUser = useCallback(async () => {
    if (!selectedUser?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/cases/user/${selectedUser.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: (status) => true, // we'll handle non-2xx manually
        }
      );

      if (response.status === 204) {
        // No content — treat as empty list
        setCases([]);
      } else if (response.status >= 200 && response.status < 300) {
        const data = response.data ?? [];
        setCases(Array.isArray(data) ? data : []);
      } else if (response.status === 403) {
        setError(new Error("Not authorized to view this user's cases"));
        setCases([]);
      } else {
        setError(new Error(response.statusText || "Failed to fetch cases"));
        setCases([]);
      }
    } catch (err) {
      console.error("Failed to fetch cases for user:", err);
      setError(err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [selectedUser, token]);

  useEffect(() => {
    setCases(null);
    if (selectedUser?.id) fetchCasesForUser();
  }, [selectedUser, fetchCasesForUser]);

  // Cache documents per case: { [caseId]: { loading, error, documents } }
  const [caseDocs, setCaseDocs] = useState({});

  const fetchDocumentsForCase = useCallback(
    async (caseId) => {
      if (!caseId || caseDocs[caseId]?.loading) return;

      setCaseDocs((prev) => ({ ...prev, [caseId]: { loading: true } }));

      try {
        const resp = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/cases/${caseId}/documents/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const docs = resp.data || [];
        setCaseDocs((prev) => ({
          ...prev,
          [caseId]: { loading: false, documents: docs },
        }));
      } catch (err) {
        console.error(`Failed to fetch documents for case ${caseId}:`, err);
        setCaseDocs((prev) => ({
          ...prev,
          [caseId]: { loading: false, error: err, documents: [] },
        }));
      }
    },
    [token, caseDocs]
  );

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Card>
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        </Card>
      </div>
    );
  }

  // Loaded but empty
  if (cases?.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <Card>
          <Empty
            description={<span>User has not uploaded any documents yet</span>}
          />
        </Card>
      </div>
    );
  }

  // Default: show simple list of cases when present
  return (
    <div
      style={{
        padding: 12,
        maxHeight: "85vh",
        overflowY: "auto",
      }}
    >
      {error && (
        <Alert
          type="error"
          message="Unable to load cases"
          description={error.message}
          style={{ marginBottom: 12 }}
        />
      )}

      {cases?.length > 0 && (
        <Collapse
          accordion={false}
          onChange={(activeKeys) => {
            // activeKeys may be string or array depending on mode; normalize
            const keys = Array.isArray(activeKeys) ? activeKeys : [activeKeys];
            keys.forEach((caseId) => {
              if (caseId) fetchDocumentsForCase(caseId);
            });
          }}
          items={cases.map((c) => ({
            key: c.id,
            label: (
              <Space>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div
                    style={{ fontSize: 12, color: "#666" }}
                  >{`Case ID: ${c.id}`}</div>
                </div>
              </Space>
            ),
            children: (
              <div style={{ padding: 8 }}>
                {caseDocs[c.id]?.loading ? (
                  <Skeleton active />
                ) : (
                  <DocumentList
                    documents={caseDocs[c.id]?.documents || []}
                    setDocuments={(docs) =>
                      setCaseDocs((prev) => ({
                        ...prev,
                        [c.id]: { ...(prev[c.id] || {}), documents: docs },
                      }))
                    }
                    token={token}
                    hasProcessingDocuments={false}
                    scrollableTargetId={`case-docs-${c.id}`}
                    canDelete={false}
                  />
                )}
              </div>
            ),
          }))}
        />
      )}
    </div>
  );
};

export default UserDocuments;
