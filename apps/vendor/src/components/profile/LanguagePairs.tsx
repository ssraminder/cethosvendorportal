import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getFullProfile,
  updateLanguagePairs,
  type LanguagePair,
} from "../../api/vendorProfile";
import { Globe, Plus, X, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

export function LanguagePairs() {
  const { sessionToken } = useVendorAuth();
  const [pairs, setPairs] = useState<LanguagePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadPairs = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await getFullProfile(sessionToken);
      if (result.language_pairs) {
        setPairs(result.language_pairs);
      }
    } catch {
      setError("Failed to load language pairs");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadPairs();
  }, [loadPairs]);

  const handleAdd = async () => {
    if (!sessionToken || !newSource.trim() || !newTarget.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateLanguagePairs(sessionToken, {
        action: "add",
        source_language: newSource.trim(),
        target_language: newTarget.trim(),
      });
      if (result.success && result.language_pairs) {
        setPairs(result.language_pairs);
        setNewSource("");
        setNewTarget("");
        setShowAdd(false);
      } else {
        setError(result.error || "Failed to add language pair");
      }
    } catch {
      setError("Failed to add language pair");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pairId: string) => {
    if (!sessionToken) return;
    setActionId(pairId);
    try {
      const result = await updateLanguagePairs(sessionToken, {
        action: "toggle",
        language_pair_id: pairId,
      });
      if (result.success && result.language_pairs) {
        setPairs(result.language_pairs);
      }
    } catch {
      setError("Failed to update language pair");
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = async (pairId: string) => {
    if (!sessionToken) return;
    setActionId(pairId);
    try {
      const result = await updateLanguagePairs(sessionToken, {
        action: "remove",
        language_pair_id: pairId,
      });
      if (result.success && result.language_pairs) {
        setPairs(result.language_pairs);
      }
    } catch {
      setError("Failed to remove language pair");
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const activePairs = pairs.filter((p) => p.is_active);
  const inactivePairs = pairs.filter((p) => !p.is_active);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Language Pairs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activePairs.length} active pair{activePairs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Add Pair
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Language Pair</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Source language (e.g., English)"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <span className="hidden sm:flex items-center text-gray-400">→</span>
            <input
              type="text"
              placeholder="Target language (e.g., French)"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving || !newSource.trim() || !newTarget.trim()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "Adding..." : "Add"}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Pairs */}
      <div className="space-y-2">
        {activePairs.map((pair) => (
          <div
            key={pair.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-teal-600" />
              <div>
                <span className="font-medium text-gray-900">
                  {pair.source_language}
                </span>
                <span className="mx-2 text-gray-400">→</span>
                <span className="font-medium text-gray-900">
                  {pair.target_language}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Active
              </span>
              <button
                onClick={() => handleToggle(pair.id)}
                disabled={actionId === pair.id}
                className="p-1 text-gray-400 hover:text-amber-600"
                title="Deactivate"
              >
                {actionId === pair.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ToggleRight className="h-5 w-5 text-teal-600" />
                )}
              </button>
              <button
                onClick={() => handleRemove(pair.id)}
                disabled={actionId === pair.id}
                className="p-1 text-gray-400 hover:text-red-600"
                title="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Inactive Pairs */}
      {inactivePairs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Inactive ({inactivePairs.length})
          </h2>
          <div className="space-y-2">
            {inactivePairs.map((pair) => (
              <div
                key={pair.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <div className="text-gray-500">
                    <span>{pair.source_language}</span>
                    <span className="mx-2">→</span>
                    <span>{pair.target_language}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Inactive
                  </span>
                  <button
                    onClick={() => handleToggle(pair.id)}
                    disabled={actionId === pair.id}
                    className="p-1 text-gray-400 hover:text-teal-600"
                    title="Reactivate"
                  >
                    {actionId === pair.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pairs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Globe className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No language pairs yet</p>
          <p className="text-sm">Click "Add Pair" to get started.</p>
        </div>
      )}
    </div>
  );
}
