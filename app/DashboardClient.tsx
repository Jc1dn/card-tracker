"use client";

import React, { useState } from "react";
import { Plus, Minus, Trash2, X, Eye, Edit, Check, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { addEntries, deleteEntry, updateEntry, addPremiumTopUp, toggleDelivery } from "./actions";

type DashboardEntry = {
  id: string;
  date: string;
  product: string;
  quantity: number;
  credit: number;
  spent: number;
  cookies: string;
  uuid: string | null;
  deliveryLink: string | null;
  delivered: boolean;
};

type EntryGroup = {
  key: string;
  uuid: string | null;
  group: DashboardEntry[];
  totalQty: number;
  credit: number;
  spent: number;
  cookies: string;
  date: string;
  deliveredCount: number;
};

type GroupEditForm = {
  credit: number | string;
  spent: number | string;
};

type ProductEditForm = {
  product: string;
  quantity: number | string;
  deliveryLink: string;
};

export default function DashboardClient({
  initialEntries,
  premiumTotal,
}: {
  initialEntries: DashboardEntry[];
  premiumTotal: number;
}) {
  const [entries, setEntries] = useState<DashboardEntry[]>(initialEntries || []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cookieModal, setCookieModal] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumAdjustmentMode, setPremiumAdjustmentMode] = useState<"add" | "subtract">("add");
  const [premiumAmount, setPremiumAmount] = useState("");

  // Expand/collapse per UUID group
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Group-level edit (credit/spent)
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [groupEditForm, setGroupEditForm] = useState<GroupEditForm>({ credit: 0, spent: 0 });

  // Product-level edit (name/qty), inside an expanded group
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productEditForm, setProductEditForm] = useState<ProductEditForm>({ product: "", quantity: 1, deliveryLink: "" });

  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-GB'),
    cookies: "",
    uuid: "",
    credit: 0,
    spent: 0,
    products: [{ name: "", quantity: 1 }]
  });

  const totalCredit = entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
  const totalSpent = entries.reduce((sum, e) => sum + (Number(e.spent) || 0), 0);
  const ownMoneySpent = totalSpent + premiumTotal;

  // --- Group entries by UUID ---
  const groupsMap = new Map<string, DashboardEntry[]>();
  for (const e of entries) {
    const trimmedUuid = e.uuid?.trim();
    const key = trimmedUuid ? trimmedUuid : `__single_${e.id}`;
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(e);
  }
  const groups = Array.from(groupsMap.entries()).map(([key, group]) => ({
    key,
    uuid: key.startsWith('__single_') ? null : key,
    group,
    totalQty: group.reduce((s, e) => s + (Number(e.quantity) || 0), 0),
    credit: group.reduce((s, e) => s + (Number(e.credit) || 0), 0),
    spent: group.reduce((s, e) => s + (Number(e.spent) || 0), 0),
    cookies: group[0].cookies,
    date: group[0].date,
    deliveredCount: group.filter((e) => e.delivered).length,
  }));

  const findCreditHolder = (group: DashboardEntry[]) =>
    group.find(e => Number(e.credit) > 0 || Number(e.spent) > 0) || group[0];

  const getDeliveryHref = (value: string) => {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trimmed)}`;
  };

  const getDeliveryLabel = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) return trimmed.length > 18 ? `${trimmed.slice(0, 18)}...` : trimmed;

    try {
      const url = new URL(trimmed);
      const compactPath = url.pathname === "/" ? "" : url.pathname;
      const label = `${url.hostname}${compactPath}`;
      return label.length > 24 ? `${label.slice(0, 24)}...` : label;
    } catch {
      return trimmed.length > 24 ? `${trimmed.slice(0, 24)}...` : trimmed;
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setFormError("");
    setFormData({
      date: new Date().toLocaleDateString('en-GB'),
      cookies: "",
      uuid: "",
      credit: 0,
      spent: 0,
      products: [{ name: "", quantity: 1 }]
    });
  };

  const handleSave = async () => {
    if (!formData.cookies.trim() || !formData.uuid.trim()) {
      setFormError("Cookies JSON and UUID are both required before saving.");
      return;
    }
    if (formData.products.some(p => !p.name.trim())) {
      setFormError("Every product needs a name.");
      return;
    }

    const payload = formData.products.map((p, index) => ({
      date: formData.date,
      cookies: formData.cookies,
      uuid: formData.uuid,
      credit: index === 0 ? Number(formData.credit) : 0,
      spent: index === 0 ? Number(formData.spent) : 0,
      product: p.name,
      quantity: Number(p.quantity)
    }));

    await addEntries(payload);
    window.location.reload();
  };

  // --- Group-level edit (credit/spent) ---
  const startGroupEdit = (g: EntryGroup) => {
    setEditingGroupKey(g.key);
    setGroupEditForm({ credit: g.credit, spent: g.spent });
  };

  const cancelGroupEdit = () => {
    setEditingGroupKey(null);
    setGroupEditForm({ credit: 0, spent: 0 });
  };

  const saveGroupEdit = async (g: EntryGroup) => {
    const holder = findCreditHolder(g.group);
    const newCredit = Number(groupEditForm.credit) || 0;
    const newSpent = Number(groupEditForm.spent) || 0;

    await updateEntry(holder.id, {
      product: holder.product,
      quantity: holder.quantity,
      credit: newCredit,
      spent: newSpent,
    });

    setEntries(entries.map(e =>
      e.id === holder.id ? { ...e, credit: newCredit, spent: newSpent } : e
    ));
    setEditingGroupKey(null);
  };

  // --- Product-level edit (name/qty) ---
  const startProductEdit = (entry: DashboardEntry) => {
    setEditingProductId(entry.id);
    setProductEditForm({ product: entry.product, quantity: entry.quantity, deliveryLink: entry.deliveryLink || "" });
  };

  const cancelProductEdit = () => {
    setEditingProductId(null);
    setProductEditForm({ product: "", quantity: 1, deliveryLink: "" });
  };

  const saveProductEdit = async (entry: DashboardEntry) => {
    const deliveryLink = productEditForm.deliveryLink.trim() || null;
    await updateEntry(entry.id, {
      product: productEditForm.product,
      quantity: Number(productEditForm.quantity) || 0,
      credit: entry.credit,
      spent: entry.spent,
      deliveryLink,
    });
    setEntries(entries.map(e =>
      e.id === entry.id ? { ...e, product: productEditForm.product, quantity: Number(productEditForm.quantity) || 0, deliveryLink } : e
    ));
    setEditingProductId(null);
  };

  const handleToggleDelivered = async (entry: DashboardEntry) => {
    await toggleDelivery(entry.id, entry.delivered);
    setEntries(entries.map(e =>
      e.id === entry.id ? { ...e, delivered: !entry.delivered } : e
    ));
  };

  // --- Delete ---
  const deleteGroup = async (g: EntryGroup) => {
    if (!confirm(`Delete this account and all ${g.group.length} product(s) under it?`)) return;
    await Promise.all(g.group.map((e) => deleteEntry(e.id)));
    window.location.reload();
  };

  const deleteProduct = async (id: string) => {
    await deleteEntry(id);
    window.location.reload();
  };

  // --- Premium top-up ---
  const openPremiumModal = (mode: "add" | "subtract") => {
    setPremiumAdjustmentMode(mode);
    setPremiumAmount("");
    setIsPremiumModalOpen(true);
  };

  const closePremiumModal = () => {
    setIsPremiumModalOpen(false);
    setPremiumAmount("");
  };

  const handleSavePremium = async () => {
    const amount = Math.abs(Number(premiumAmount));
    if (!amount) return;
    await addPremiumTopUp(premiumAdjustmentMode === "subtract" ? -amount : amount);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Card Tracker</h1>
          <button onClick={() => setIsModalOpen(true)} className="bg-white text-black px-4 py-2 rounded-md font-bold flex items-center gap-2">
            <Plus size={18} /> Add Entry
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
            <p className="text-neutral-400 text-sm">Total Credit</p>
            <p className="text-3xl font-bold mt-2">{totalCredit}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
            <p className="text-neutral-400 text-sm">Own Money Spent</p>
            <p className="text-3xl font-bold mt-2">£{ownMoneySpent.toFixed(2)}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-sm">Premium Credits</p>
              <p className="text-3xl font-bold mt-2">{premiumTotal}</p>
            </div>
            <div className="flex gap-2 self-start">
              <button
                onClick={() => openPremiumModal("subtract")}
                className="bg-neutral-800 hover:bg-neutral-700 transition p-2 rounded-md"
                aria-label="Subtract premium credits"
                title="Subtract premium credits"
              >
                <Minus size={16} />
              </button>
              <button
                onClick={() => openPremiumModal("add")}
                className="bg-neutral-800 hover:bg-neutral-700 transition p-2 rounded-md"
                aria-label="Add premium credits"
                title="Add premium credits"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Grouped Table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-950/50 text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="p-4 w-8"></th>
                <th className="p-4">UUID</th>
                <th className="p-4">Products</th>
                <th className="p-4">Qty</th>
                <th className="p-4">Credit</th>
                <th className="p-4">Spent</th>
                <th className="p-4">Delivered</th>
                <th className="p-4">Delivery</th>
                <th className="p-4">Account</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isExpanded = expandedKey === g.key;
                const isEditingGroup = editingGroupKey === g.key;
                return (
                  <React.Fragment key={g.key}>
                    <tr key={g.key} className="border-b border-neutral-800">
                      <td className="p-4">
                        <button onClick={() => setExpandedKey(isExpanded ? null : g.key)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="p-4 font-mono text-xs">{g.uuid || "-"}</td>
                      <td className="p-4 text-neutral-400">
                        {g.group.length} product{g.group.length > 1 ? "s" : ""}
                      </td>
                      <td className="p-4">{g.totalQty}</td>
                      <td className="p-4">
                        {isEditingGroup ? (
                          <input
                            type="number"
                            value={groupEditForm.credit}
                            onChange={e => setGroupEditForm({ ...groupEditForm, credit: e.target.value })}
                            className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 w-20"
                          />
                        ) : g.credit}
                      </td>
                      <td className="p-4">
                        {isEditingGroup ? (
                          <input
                            type="number"
                            step="0.01"
                            value={groupEditForm.spent}
                            onChange={e => setGroupEditForm({ ...groupEditForm, spent: e.target.value })}
                            className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 w-20"
                          />
                        ) : `£${Number(g.spent).toFixed(2)}`}
                      </td>
                      <td className="p-4 text-neutral-400">
                        {g.deliveredCount}/{g.group.length}
                      </td>
                      <td className="p-4 text-neutral-600">-</td>
                      <td className="p-4">
                        <button onClick={() => setCookieModal(g.cookies)} className="text-blue-400 flex items-center gap-1 hover:text-blue-300 transition">
                          <Eye size={14} /> View
                        </button>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-3">
                        {isEditingGroup ? (
                          <>
                            <button onClick={() => saveGroupEdit(g)} className="text-green-400 hover:text-green-300 transition" aria-label="Save">
                              <Check size={16} />
                            </button>
                            <button onClick={cancelGroupEdit} className="text-neutral-400 hover:text-white transition" aria-label="Cancel">
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startGroupEdit(g)} className="text-neutral-400 hover:text-white transition" aria-label="Edit credit/spent">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => deleteGroup(g)} className="text-red-400 hover:text-red-300 transition" aria-label="Delete account">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>

                    {isExpanded && g.group.map((entry) => {
                      const isEditingProduct = editingProductId === entry.id;
                      return (
                        <tr key={entry.id} className="border-b border-neutral-800 bg-neutral-950/40">
                          <td className="p-3"></td>
                          <td className="p-3 text-neutral-600 text-xs">↳</td>
                          <td className="p-3">
                            {isEditingProduct ? (
                              <input
                                value={productEditForm.product}
                                onChange={e => setProductEditForm({ ...productEditForm, product: e.target.value })}
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 w-full"
                              />
                            ) : entry.product}
                          </td>
                          <td className="p-3">
                            {isEditingProduct ? (
                              <input
                                type="number"
                                value={productEditForm.quantity}
                                onChange={e => setProductEditForm({ ...productEditForm, quantity: e.target.value })}
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 w-16"
                              />
                            ) : entry.quantity}
                          </td>
                          <td className="p-3 text-neutral-600" colSpan={2}>—</td>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={entry.delivered}
                              onChange={() => handleToggleDelivered(entry)}
                              className="h-4 w-4 accent-white"
                              aria-label={`Mark ${entry.product} delivered`}
                            />
                          </td>
                          <td className="p-3 max-w-48">
                            {isEditingProduct ? (
                              <input
                                placeholder="Royal Mail link or tracking"
                                value={productEditForm.deliveryLink}
                                onChange={e => setProductEditForm({ ...productEditForm, deliveryLink: e.target.value })}
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 w-full"
                              />
                            ) : entry.deliveryLink ? (
                              <a
                                href={getDeliveryHref(entry.deliveryLink)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 transition truncate block"
                                title={entry.deliveryLink}
                              >
                                {getDeliveryLabel(entry.deliveryLink)}
                              </a>
                            ) : (
                              <span className="text-neutral-600">-</span>
                            )}
                          </td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right flex justify-end gap-3">
                            {isEditingProduct ? (
                              <>
                                <button onClick={() => saveProductEdit(entry)} className="text-green-400 hover:text-green-300 transition" aria-label="Save">
                                  <Check size={14} />
                                </button>
                                <button onClick={cancelProductEdit} className="text-neutral-400 hover:text-white transition" aria-label="Cancel">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startProductEdit(entry)} className="text-neutral-400 hover:text-white transition" aria-label="Edit product">
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => deleteProduct(entry.id)} className="text-red-400 hover:text-red-300 transition" aria-label="Delete product">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Modal */}
      {cookieModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between mb-4">
              <h2 className="font-bold">Cookie Data</h2>
              <button onClick={() => setCookieModal(null)}><X size={20} /></button>
            </div>
            {(() => {
              try {
                const parsed = JSON.parse(cookieModal);
                return (
                  <pre className="bg-black p-4 rounded text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(parsed, null, 2)}
                  </pre>
                );
              } catch {
                return (
                  <div>
                    <p className="text-amber-400 text-xs mb-2 flex items-center gap-1">
                      <AlertCircle size={12} /> Stored value is not valid JSON — showing raw text
                    </p>
                    <pre className="bg-black p-4 rounded text-xs text-neutral-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {cookieModal || "(empty)"}
                    </pre>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {/* Premium Top-up Modal */}
      {isPremiumModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl w-full max-w-sm">
            <div className="flex justify-between mb-4">
              <h2 className="font-bold">
                {premiumAdjustmentMode === "subtract" ? "Subtract Premium Credits" : "Add Premium Credits"}
              </h2>
              <button onClick={closePremiumModal}><X size={20} /></button>
            </div>
            <p className="text-neutral-400 text-xs mb-3">
              {premiumAdjustmentMode === "subtract"
                ? "Correct the Premium Credits total if you added too much."
                : "Log a payment you made to someone for premium credits."}
            </p>
            <input
              type="number"
              placeholder="Amount"
              value={premiumAmount}
              onChange={e => setPremiumAmount(e.target.value)}
              className="bg-neutral-950 p-3 rounded w-full border border-neutral-800 focus:outline-none focus:border-neutral-600 transition mb-4"
            />
            <div className="flex gap-3">
              <button onClick={closePremiumModal} className="w-1/3 bg-neutral-800 text-white py-3 rounded-lg font-bold hover:bg-neutral-700 transition">
                Cancel
              </button>
              <button onClick={handleSavePremium} className="w-2/3 bg-white text-black py-3 rounded-lg font-bold hover:bg-neutral-200 transition">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl w-full max-w-2xl">

            <div className="space-y-3 mb-6 pb-6 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2">Account Details</h3>
              <div className="flex gap-3">
                <input type="text" placeholder="Date (DD/MM/YYYY)" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="bg-neutral-950 p-3 rounded w-1/3 border border-neutral-800 focus:outline-none focus:border-neutral-600 transition" />
                <input
                  placeholder='Paste Cookies JSON (e.g., {"value": "..."}) *'
                  value={formData.cookies}
                  onChange={e => setFormData({ ...formData, cookies: e.target.value })}
                  className={`bg-neutral-950 p-3 rounded flex-1 border focus:outline-none focus:border-neutral-600 transition font-mono text-sm ${!formData.cookies.trim() && formError ? "border-red-600" : "border-neutral-800"}`}
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <input
                  placeholder="Account UUID *"
                  value={formData.uuid}
                  onChange={e => setFormData({ ...formData, uuid: e.target.value })}
                  className={`col-span-2 bg-neutral-950 p-3 rounded border focus:outline-none focus:border-neutral-600 transition ${!formData.uuid.trim() && formError ? "border-red-600" : "border-neutral-800"}`}
                />
                <input type="number" placeholder="Total Credit" value={formData.credit} onChange={e => setFormData({ ...formData, credit: Number(e.target.value) })} className="bg-neutral-950 p-3 rounded border border-neutral-800 focus:outline-none focus:border-neutral-600 transition" />
                <input type="number" step="0.01" placeholder="Total £ Spent" value={formData.spent} onChange={e => setFormData({ ...formData, spent: Number(e.target.value) })} className="bg-neutral-950 p-3 rounded border border-neutral-800 focus:outline-none focus:border-neutral-600 transition" />
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2">Products</h3>
              {formData.products.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <input placeholder="Product Name (e.g., lion, tiger, pack)" value={p.name} onChange={e => { const n = [...formData.products]; n[i].name = e.target.value; setFormData({ ...formData, products: n }) }} className="flex-1 bg-neutral-950 p-3 rounded border border-neutral-800 focus:outline-none focus:border-neutral-600 transition" />
                  <input type="number" placeholder="Qty" value={p.quantity} onChange={e => { const n = [...formData.products]; n[i].quantity = Number(e.target.value); setFormData({ ...formData, products: n }) }} className="w-24 bg-neutral-950 p-3 rounded border border-neutral-800 focus:outline-none focus:border-neutral-600 transition" />
                </div>
              ))}
            </div>

            <button onClick={() => setFormData({ ...formData, products: [...formData.products, { name: "", quantity: 1 }] })} className="text-sm text-neutral-400 mb-4 block hover:text-white transition">
              + Add Another Product
            </button>

            {formError && (
              <p className="text-red-400 text-xs mb-4 flex items-center gap-1">
                <AlertCircle size={12} /> {formError}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={handleClose} className="w-1/3 bg-neutral-800 text-white py-3 rounded-lg font-bold hover:bg-neutral-700 transition">
                Cancel
              </button>
              <button onClick={handleSave} className="w-2/3 bg-white text-black py-3 rounded-lg font-bold hover:bg-neutral-200 transition">
                Save All
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
