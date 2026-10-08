"""
SPACE EYE — Evidence PDF Builder
Generates a PDF report with verification results.
"""
from fpdf import FPDF
from datetime import datetime
import io
import os


class EvidenceBuilder:
    def build(self, verification_result: dict, field_image_bytes: bytes,
              creative_image_bytes: bytes, device_name: str,
              campaign_name: str) -> bytes:
        """
        Generate a PDF evidence report.
        Returns PDF as bytes.
        """
        pdf = FPDF()
        pdf.add_page()

        # Header
        pdf.set_font("Helvetica", "B", 18)
        pdf.cell(0, 12, "SPACE EYE - Evidencia de Verificacion", ln=True, align="C")
        pdf.ln(5)

        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True, align="C")
        pdf.ln(10)

        # Campaign & Device info
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Informacion General", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(60, 7, "Campana:", border=0)
        pdf.cell(0, 7, campaign_name, ln=True)
        pdf.cell(60, 7, "Device:", border=0)
        pdf.cell(0, 7, device_name, ln=True)
        pdf.ln(5)

        # Verification results
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Resultados de Verificacion", ln=True)
        pdf.set_font("Helvetica", "", 10)

        result_color = (0, 128, 0) if verification_result.get("is_correct") else (200, 0, 0)
        pdf.set_text_color(*result_color)
        verdict = "CORRECTO" if verification_result.get("is_correct") else "INCORRECTO"
        pdf.cell(60, 7, "Veredicto:", border=0)
        pdf.cell(0, 7, verdict, ln=True)
        pdf.set_text_color(0, 0, 0)

        pdf.cell(60, 7, "Confianza:", border=0)
        conf = verification_result.get("confidence", 0)
        pdf.cell(0, 7, f"{conf * 100:.1f}%", ln=True)

        # Lo que de verdad decide el veredicto: cuantos puntos de la creatividad
        # se localizaron en la foto y que parte del cuadro ocupa. Va primero
        # porque es lo que hay que mirar al revisar un caso dudoso; el SSIM y los
        # demas quedan de apoyo.
        if verification_result.get("puntos_encajan") is not None:
            pdf.cell(60, 7, "Puntos que encajan:", border=0)
            pdf.cell(0, 7, "%s (de %s emparejados)" % (
                verification_result.get("puntos_encajan"),
                verification_result.get("puntos_emparejados", "?"),
            ), ln=True)

            area = verification_result.get("area_creatividad")
            if area is not None:
                pdf.cell(60, 7, "Ocupa del cuadro:", border=0)
                pdf.cell(0, 7, f"{area * 100:.0f}%", ln=True)

        pdf.cell(60, 7, "SSIM Score:", border=0)
        pdf.cell(0, 7, str(verification_result.get("ssim_score", "N/A")), ln=True)

        pdf.cell(60, 7, "pHash Distance:", border=0)
        pdf.cell(0, 7, str(verification_result.get("phash_distance", "N/A")), ln=True)

        pdf.cell(60, 7, "Histogram Score:", border=0)
        pdf.cell(0, 7, str(verification_result.get("histogram_score", "N/A")), ln=True)

        if verification_result.get("ocr_text"):
            pdf.cell(60, 7, "OCR Match:", border=0)
            pdf.cell(0, 7, "Si" if verification_result.get("ocr_match") else "No", ln=True)
            pdf.cell(60, 7, "OCR Texto:", border=0)
            pdf.multi_cell(0, 7, verification_result["ocr_text"][:200])

        pdf.cell(60, 7, "Razon:", border=0)
        pdf.cell(0, 7, verification_result.get("reason", ""), ln=True)

        pdf.cell(60, 7, "Tiempo proceso:", border=0)
        pdf.cell(0, 7, f"{verification_result.get('processing_ms', 0)} ms", ln=True)

        pdf.ln(10)

        # Images section
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Imagenes", ln=True)
        pdf.set_font("Helvetica", "", 10)

        # Save temp images for PDF embedding
        field_path = self._save_temp(field_image_bytes, "field")
        creative_path = self._save_temp(creative_image_bytes, "creative")

        if field_path:
            pdf.cell(0, 7, "Foto de campo:", ln=True)
            try:
                pdf.image(field_path, x=10, w=90)
            except Exception:
                pdf.cell(0, 7, "[Imagen no disponible]", ln=True)
            pdf.ln(5)

        if creative_path:
            pdf.cell(0, 7, "Creatividad esperada:", ln=True)
            try:
                pdf.image(creative_path, x=10, w=90)
            except Exception:
                pdf.cell(0, 7, "[Imagen no disponible]", ln=True)

        # Cleanup temp files
        self._cleanup_temp(field_path)
        self._cleanup_temp(creative_path)

        # Return PDF bytes
        return bytes(pdf.output())

    def _save_temp(self, image_bytes: bytes, prefix: str) -> str:
        if not image_bytes:
            return None
        path = f"/tmp/space_eye_{prefix}_{id(image_bytes)}.jpg"
        try:
            with open(path, "wb") as f:
                f.write(image_bytes)
            return path
        except Exception:
            return None

    def _cleanup_temp(self, path: str):
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass
