"""
SPACE EYE — Verificador 3 capas
Compara foto del campo vs creatividad esperada.
Capas: 1) SSIM + Histogram, 2) pHash, 3) OCR
"""
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
import imagehash
from PIL import Image
import pytesseract
import io
import time


class Verifier:
    def __init__(self, min_ssim=0.7, max_phash_distance=10):
        self.min_ssim = min_ssim
        self.max_phash_distance = max_phash_distance

    def verify(self, field_image_bytes: bytes, creative_image_bytes: bytes,
               expected_text: str = None) -> dict:
        """
        Run 3-layer verification.
        Returns dict with scores and final verdict.
        """
        start = time.time()

        # Decode images
        field_img = cv2.imdecode(
            np.frombuffer(field_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        creative_img = cv2.imdecode(
            np.frombuffer(creative_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )

        if field_img is None or creative_img is None:
            return {
                "is_correct": False,
                "confidence": 0.0,
                "reason": "failed_to_decode_images",
                "processing_ms": int((time.time() - start) * 1000),
            }

        # Resize field image to match creative dimensions
        h, w = creative_img.shape[:2]
        field_resized = cv2.resize(field_img, (w, h))

        # Layer 1: SSIM
        ssim_score = self._compute_ssim(field_resized, creative_img)

        # Layer 1b: Histogram correlation
        hist_score = self._compute_histogram(field_resized, creative_img)

        # Layer 2: pHash
        phash_distance = self._compute_phash(field_image_bytes, creative_image_bytes)

        # Layer 3: OCR (optional)
        ocr_result = None
        if expected_text:
            ocr_result = self._check_ocr(field_img, expected_text)

        # Decision logic
        is_correct, confidence, reason = self._decide(
            ssim_score, hist_score, phash_distance, ocr_result
        )

        processing_ms = int((time.time() - start) * 1000)

        return {
            "ssim_score": round(ssim_score, 4),
            "histogram_score": round(hist_score, 4),
            "phash_distance": phash_distance,
            "ocr_text": ocr_result["text"] if ocr_result else None,
            "ocr_match": ocr_result["match"] if ocr_result else None,
            "ocr_confidence": ocr_result["confidence"] if ocr_result else None,
            "is_correct": is_correct,
            "confidence": round(confidence, 3),
            "reason": reason,
            "processing_ms": processing_ms,
        }

    def _compute_ssim(self, img1, img2) -> float:
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        score, _ = ssim(gray1, gray2, full=True)
        return float(score)

    def _compute_histogram(self, img1, img2) -> float:
        hist1 = cv2.calcHist([img1], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
        hist2 = cv2.calcHist([img2], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
        cv2.normalize(hist1, hist1)
        cv2.normalize(hist2, hist2)
        return float(cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL))

    def _compute_phash(self, bytes1: bytes, bytes2: bytes) -> int:
        img1 = Image.open(io.BytesIO(bytes1))
        img2 = Image.open(io.BytesIO(bytes2))
        hash1 = imagehash.phash(img1)
        hash2 = imagehash.phash(img2)
        return int(hash1 - hash2)

    def _check_ocr(self, img, expected_text: str) -> dict:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Enhance contrast for OCR
        gray = cv2.equalizeHist(gray)

        try:
            data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT,
                                              lang='spa+eng')
            texts = [t for t, c in zip(data['text'], data['conf'])
                     if int(c) > 30 and t.strip()]
            full_text = ' '.join(texts).lower()
            expected_lower = expected_text.lower().strip()

            # Check if expected text keywords are present
            keywords = expected_lower.split()
            matched = sum(1 for kw in keywords if kw in full_text)
            match_ratio = matched / len(keywords) if keywords else 0

            return {
                "text": full_text[:500],
                "match": match_ratio >= 0.5,
                "confidence": round(match_ratio, 3),
            }
        except Exception as e:
            return {
                "text": f"OCR error: {str(e)}",
                "match": False,
                "confidence": 0.0,
            }

    def _decide(self, ssim_score, hist_score, phash_distance, ocr_result):
        scores = []
        reasons = []

        # SSIM weight: 40%
        ssim_pass = ssim_score >= self.min_ssim
        scores.append(min(ssim_score / self.min_ssim, 1.0) * 0.4)
        if not ssim_pass:
            reasons.append(f"ssim_low({ssim_score:.3f})")

        # Histogram weight: 20%
        hist_pass = hist_score >= 0.5
        scores.append(min(hist_score, 1.0) * 0.2)
        if not hist_pass:
            reasons.append(f"histogram_low({hist_score:.3f})")

        # pHash weight: 25%
        phash_pass = phash_distance <= self.max_phash_distance
        phash_norm = max(0, 1 - phash_distance / (self.max_phash_distance * 2))
        scores.append(phash_norm * 0.25)
        if not phash_pass:
            reasons.append(f"phash_high({phash_distance})")

        # OCR weight: 15% (if available)
        if ocr_result:
            ocr_pass = ocr_result["match"]
            scores.append(ocr_result["confidence"] * 0.15)
            if not ocr_pass:
                reasons.append("ocr_mismatch")
        else:
            scores.append(0.15)  # No OCR = assume pass

        confidence = sum(scores)
        is_correct = confidence >= 0.6 and (ssim_pass or phash_pass)
        reason = "match" if is_correct else "; ".join(reasons)

        return is_correct, confidence, reason
