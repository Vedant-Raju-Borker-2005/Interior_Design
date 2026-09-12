"""Workflow 1 — the associative / recommendation layer.

Three models with one shared contract: `fit()`, `save()`, `load()`, and an
`export()` that returns JSON-safe dicts for the browser bundle. They train
offline against historical data and are testable without any renderer, exactly
as the architecture doc calls for.

    rules   = AssociationModel().fit(baskets)
    embed   = StyleEmbedder().fit(catalog_docs, style_docs)
    price   = PriceModel().fit(orders)
    bundle  = ModelBundle(rules, embed, price)
    bundle.save("artifacts/v3")
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np


# ═══════════════════════════════════════════════════════════ FP-Growth ═════
class _Node:
    __slots__ = ("item", "count", "parent", "children", "link")

    def __init__(self, item, parent):
        self.item, self.count, self.parent = item, 0, parent
        self.children, self.link = {}, None


def _build(transactions: Sequence[tuple[Sequence[str], int]], min_sup: int):
    freq: dict[str, int] = defaultdict(int)
    for items, c in transactions:
        for i in items:
            freq[i] += c
    freq = {k: v for k, v in freq.items() if v >= min_sup}
    if not freq:
        return None, None, None
    root, heads = _Node(None, None), {}
    for items, c in transactions:
        node = root
        for it in sorted((i for i in items if i in freq), key=lambda i: (-freq[i], i)):
            child = node.children.get(it)
            if child is None:
                child = _Node(it, node)
                node.children[it] = child
                child.link = heads.get(it)
                heads[it] = child
            child.count += c
            node = child
    return root, heads, freq


def _mine(transactions, min_sup: int, suffix: list[str], out: dict, max_len: int):
    """Conditional pattern bases are carried *weighted*. Expanding them by
    duplicating each path `count` times is the textbook formulation and is
    exponential on real basket sizes — it will hang."""
    if len(suffix) >= max_len:
        return
    root, heads, freq = _build(transactions, min_sup)
    if root is None:
        return
    for item in sorted(heads, key=lambda i: freq[i]):
        pattern = suffix + [item]
        out[frozenset(pattern)] = freq[item]
        cond, node = [], heads[item]
        while node is not None:
            path, p = [], node.parent
            while p is not None and p.item is not None:
                path.append(p.item)
                p = p.parent
            if path:
                cond.append((path, node.count))
            node = node.link
        if cond:
            _mine(cond, min_sup, pattern, out, max_len)


@dataclass
class Rule:
    antecedent: list[str]
    consequent: str
    support: float
    confidence: float
    lift: float

    def to_dict(self) -> dict[str, Any]:
        return dict(antecedent=self.antecedent, consequent=self.consequent,
                    support=round(self.support, 4),
                    confidence=round(self.confidence, 4), lift=round(self.lift, 4))


class AssociationModel:
    """FP-Growth over historical bundles → ranked association rules."""

    def __init__(self, min_support: float = 0.04, min_confidence: float = 0.45,
                 max_len: int = 3, keep: int = 160):
        self.min_support = min_support
        self.min_confidence = min_confidence
        self.max_len = max_len
        self.keep = keep
        self.rules: list[Rule] = []
        self.n_baskets = 0

    def fit(self, baskets: Sequence[Sequence[str]]) -> "AssociationModel":
        self.n_baskets = n = len(baskets)
        min_sup = int(self.min_support * n)
        patterns: dict[frozenset[str], int] = {}
        _mine([(list(b), 1) for b in baskets], min_sup, [], patterns, self.max_len)
        rules: list[Rule] = []
        for pat, sup in patterns.items():
            if len(pat) < 2:
                continue
            for cons in pat:
                ante = frozenset(pat - {cons})
                if ante not in patterns:
                    continue
                conf = sup / patterns[ante]
                cons_sup = patterns.get(frozenset([cons]), 0) / n
                if conf < self.min_confidence or cons_sup == 0:
                    continue
                rules.append(Rule(sorted(ante), cons, sup / n, conf, conf / cons_sup))
        rules.sort(key=lambda r: (-r.lift, -r.confidence))
        self.rules = rules
        return self

    def recommend(self, have: Iterable[str], limit: int = 5) -> list[dict[str, Any]]:
        have = set(have)
        best: dict[str, Rule] = {}
        for r in self.rules:
            if r.consequent in have or not set(r.antecedent) <= have:
                continue
            cur = best.get(r.consequent)
            if cur is None or r.confidence * min(r.lift, 3) > cur.confidence * min(cur.lift, 3):
                best[r.consequent] = r
        out = [dict(category=c, rule=r.to_dict(),
                    score=r.confidence * min(r.lift, 3) / 3)
               for c, r in best.items()]
        out.sort(key=lambda d: -d["score"])
        return out[:limit]

    def export(self) -> list[dict[str, Any]]:
        return [r.to_dict() for r in self.rules[:self.keep]]


# ═════════════════════════════════════════════════════ style embeddings ════
class StyleEmbedder:
    """Content-based style vectors — TF-IDF over tag documents → truncated SVD
    → L2-normalised, so items and styles live in one cosine space.

    The architecture doc specifies a **vision** embedding model (CLIP) over
    product imagery. That is a drop-in replacement: implement `fit_images` with
    your encoder and keep `vectors` / `similarity` unchanged. Everything
    downstream consumes vectors, not the encoder.
    """

    def __init__(self, dim: int = 24, random_state: int = 0):
        self.dim = dim
        self.random_state = random_state
        self.item_vectors: dict[str, list[float]] = {}
        self.style_vectors: dict[str, list[float]] = {}
        self.explained_variance = 0.0

    def fit(self, item_docs: dict[str, str],
            style_docs: dict[str, str]) -> "StyleEmbedder":
        from sklearn.decomposition import TruncatedSVD
        from sklearn.feature_extraction.text import TfidfVectorizer

        keys = list(item_docs) + list(style_docs)
        docs = list(item_docs.values()) + list(style_docs.values())
        X = TfidfVectorizer(token_pattern=r"[a-z_]+").fit_transform(docs)
        dim = min(self.dim, min(X.shape) - 1)
        svd = TruncatedSVD(n_components=dim, random_state=self.random_state)
        Z = svd.fit_transform(X)
        Z /= np.linalg.norm(Z, axis=1, keepdims=True) + 1e-9
        self.explained_variance = float(svd.explained_variance_ratio_.sum())
        self.dim = dim
        n = len(item_docs)
        self.item_vectors = {k: [round(float(v), 5) for v in Z[i]]
                             for i, k in enumerate(keys[:n])}
        self.style_vectors = {k: [round(float(v), 5) for v in Z[n + i]]
                              for i, k in enumerate(keys[n:])}
        return self

    def fit_images(self, encoder, images: dict[str, Any]) -> "StyleEmbedder":
        """Hook for the doc's vision-embedding path. `encoder(list_of_images)`
        must return an (n, d) array."""
        keys = list(images)
        Z = np.asarray(encoder([images[k] for k in keys]), dtype=float)
        Z /= np.linalg.norm(Z, axis=1, keepdims=True) + 1e-9
        self.dim = Z.shape[1]
        self.item_vectors = {k: [round(float(v), 5) for v in Z[i]]
                             for i, k in enumerate(keys)}
        return self

    def similarity(self, item: str, style: str) -> float:
        a, b = self.item_vectors.get(item), self.style_vectors.get(style)
        if not a or not b:
            return 0.5
        return (float(np.dot(a, b)) + 1) / 2

    def export(self) -> dict[str, Any]:
        return {"item_vectors": self.item_vectors, "style_vectors": self.style_vectors}


# ══════════════════════════════════════════════════════════ price model ════
@dataclass
class PriceFeatures:
    """Feature contract. Shared verbatim with the JS evaluator — changing the
    order here without re-exporting the bundle silently corrupts predictions,
    which is what `tests/test_ids.py::test_price_parity` guards."""
    names: list[str] = field(default_factory=list)


class PriceModel:
    """Gradient-boosted regressor on log price, exported tree-by-tree so the
    browser can evaluate it with no runtime."""

    def __init__(self, catalog_rows: Sequence[dict[str, Any]],
                 tiers: Sequence[str], styles: Sequence[str],
                 city_mult: dict[str, float], *, n_estimators: int = 140,
                 max_depth: int = 3, learning_rate: float = 0.09,
                 random_state: int = 0):
        self.catalog_rows = list(catalog_rows)
        self.tiers, self.styles, self.city_mult = list(tiers), list(styles), dict(city_mult)
        self.params = dict(n_estimators=n_estimators, max_depth=max_depth,
                           learning_rate=learning_rate, subsample=0.9,
                           random_state=random_state)
        self.model = None
        self.metrics: dict[str, float] = {}
        self.feature_names = (
            ["n_items", "bhk", "tier_idx", "city_mult", "style_idx",
             "footprint", "base_sum", "log_base_sum"]
            + [f"has_{r['category']}" for r in self.catalog_rows])
        self._by_cat = {r["category"]: r for r in self.catalog_rows}

    # -------------------------------------------------------- features --
    def featurise(self, items: Iterable[str], bhk: int, style: str,
                  tier: str, city: str) -> list[float]:
        present = {i for i in items if i in self._by_cat}
        base = sum(self._by_cat[i]["base_price"] for i in present)
        foot = sum(self._by_cat[i]["footprint"] for i in present)
        row = [len(present), bhk, self.tiers.index(tier),
               self.city_mult.get(city, 1.0), self.styles.index(style),
               foot, base, math.log1p(base)]
        row += [1.0 if r["category"] in present else 0.0 for r in self.catalog_rows]
        return row

    # ------------------------------------------------------------- fit --
    def fit(self, orders: Sequence[dict[str, Any]],
            prices: Sequence[float]) -> "PriceModel":
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.metrics import mean_absolute_error, r2_score
        from sklearn.model_selection import train_test_split

        X = np.array([self.featurise(o["items"], o["bhk"], o["style"],
                                     o["tier"], o["city"]) for o in orders])
        y = np.asarray(prices, dtype=float)
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)
        self.model = GradientBoostingRegressor(**self.params).fit(Xtr, np.log(ytr))
        pred = np.exp(self.model.predict(Xte))
        self.metrics = {
            "mae": float(mean_absolute_error(yte, pred)),
            "r2": float(r2_score(yte, pred)),
            "mape": float(np.mean(np.abs(pred - yte) / yte)),
            "n_train": int(len(ytr)), "n_test": int(len(yte)),
        }
        return self

    def predict(self, items: Iterable[str], bhk: int, style: str,
                tier: str, city: str) -> float:
        if self.model is None:
            raise RuntimeError("PriceModel.fit() has not been called")
        x = np.array([self.featurise(items, bhk, style, tier, city)])
        return float(np.exp(self.model.predict(x))[0])

    # ---------------------------------------------------------- export --
    def export(self) -> dict[str, Any]:
        if self.model is None:
            raise RuntimeError("PriceModel.fit() has not been called")
        trees = []
        for stage in self.model.estimators_:
            t = stage[0].tree_
            trees.append(dict(
                left=t.children_left.tolist(), right=t.children_right.tolist(),
                feature=t.feature.tolist(),
                threshold=[round(float(v), 6) for v in t.threshold],
                value=[round(float(v[0][0]), 6) for v in t.value]))
        init = float(self.model._raw_predict_init(
            np.zeros((1, self.model.n_features_in_)))[0][0])
        return dict(features=self.feature_names, log_target=True,
                    tiers=self.tiers, styles=self.styles,
                    city_mult=self.city_mult, init=init,
                    lr=float(self.model.learning_rate), trees=trees)

    @staticmethod
    def eval_exported(exported: dict[str, Any], x: Sequence[float]) -> float:
        """Reference implementation of the JS evaluator, for parity testing."""
        y = exported["init"]
        for t in exported["trees"]:
            n = 0
            while t["left"][n] != -1:
                n = t["left"][n] if x[t["feature"][n]] <= t["threshold"][n] else t["right"][n]
            y += exported["lr"] * t["value"][n]
        return math.exp(y) if exported["log_target"] else y


# ════════════════════════════════════════════════════════════ bundling ═════
@dataclass
class ModelBundle:
    association: AssociationModel
    embedder: StyleEmbedder
    price: PriceModel
    catalog_rows: list[dict[str, Any]]
    version: str = "v1"

    def export(self) -> dict[str, Any]:
        return {
            "meta": {
                "version": self.version,
                "orders": self.association.n_baskets,
                "rules": len(self.association.rules),
                "embedding_dim": self.embedder.dim,
                "explained_variance": round(self.embedder.explained_variance, 4),
                "price_mae": round(self.price.metrics.get("mae", 0)),
                "price_r2": round(self.price.metrics.get("r2", 0), 4),
                "price_mape": round(self.price.metrics.get("mape", 0), 4),
            },
            "catalog": self.catalog_rows,
            "rules": self.association.export(),
            **self.embedder.export(),
            "price": self.price.export(),
        }

    def save(self, directory: str | Path) -> Path:
        import joblib
        d = Path(directory); d.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, d / "bundle.joblib")
        (d / "model.json").write_text(json.dumps(self.export(), separators=(",", ":")))
        return d

    @staticmethod
    def load(directory: str | Path) -> "ModelBundle":
        import joblib
        return joblib.load(Path(directory) / "bundle.joblib")
