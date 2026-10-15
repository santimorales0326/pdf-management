import io
import json
import zipfile
from typing import List
from urllib.parse import quote
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="PDF Management API", description="API for unlocking, splitting, merging, and compressing PDFs")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend URL (e.g., http://localhost:3000)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def compress_pdf_bytes(file_content: bytes) -> bytes:
    """Losslessly compress page streams while preserving the document catalog."""
    if not file_content:
        raise HTTPException(status_code=400, detail="Please upload a non-empty PDF file.")
    try:
        reader = PdfReader(io.BytesIO(file_content))
        if reader.is_encrypted:
            raise HTTPException(status_code=400, detail="Unlock this PDF before compressing it.")
        writer = PdfWriter(clone_from=reader)
        try:
            for page in writer.pages:
                page.compress_content_streams(level=9)
            output = io.BytesIO()
            writer.write(output)
            compressed = output.getvalue()
        finally:
            writer.close()
        return compressed if len(compressed) < len(file_content) else file_content
    except (PdfReadError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Unable to read this PDF. It may be invalid or damaged.") from exc


@app.post("/api/compress")
async def compress_pdf(file: UploadFile = File(...)):
    file_content = await file.read()
    compressed = await run_in_threadpool(compress_pdf_bytes, file_content)
    base_name = (file.filename or "document.pdf").rsplit(".", 1)[0]
    filename = quote(f"{base_name}_compressed.pdf", safe="")
    return StreamingResponse(
        io.BytesIO(compressed),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=compressed.pdf; filename*=UTF-8''{filename}"},
    )


@app.post("/api/unlock")
async def unlock_pdf(
    file: UploadFile = File(...),
    password: str = Form(...)
):
    try:
        file_content = await file.read()
        reader = PdfReader(io.BytesIO(file_content))
        
        if not reader.is_encrypted:
            # File is not encrypted, return original file or plain copy
            out_io = io.BytesIO(file_content)
            out_io.seek(0)
            original_filename = file.filename or "document.pdf"
            base_name = original_filename.rsplit(".", 1)[0]
            return StreamingResponse(
                out_io,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{base_name}_unlocked.pdf"'}
            )
            
        # Decrypt with the provided password
        result = reader.decrypt(password)
        
        # result can be status code or True/False. Let's check reader.pages
        # If decryption fails, accessing reader.pages or key attributes raises issues or is empty.
        # According to pypdf docs, result is a status code/boolean representing success.
        # But we should verify if reader is actually decrypted.
        if result == 0 or not result:
            raise HTTPException(
                status_code=400, 
                detail="Incorrect password or unsupported encryption."
            )
            
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
            
        out_io = io.BytesIO()
        writer.write(out_io)
        out_io.seek(0)
        
        original_filename = file.filename or "document.pdf"
        base_name = original_filename.rsplit(".", 1)[0]
        
        return StreamingResponse(
            out_io,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{base_name}_unlocked.pdf"'}
        )
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to decrypt PDF: {type(e).__name__}: {str(e)}"
        )

@app.post("/api/split")
async def split_pdf_endpoint(
    file: UploadFile = File(...),
    ranges_json: str = Form(..., description="JSON string of page ranges e.g. [[1, 3], [5, 5]]")
):
    try:
        try:
            ranges = json.loads(ranges_json)
            if not isinstance(ranges, list) or not all(isinstance(r, list) and len(r) == 2 for r in ranges):
                raise ValueError()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid ranges format. Must be a JSON array of [start, end] pairs (e.g. [[1, 3], [5, 5]])."
            )

        file_content = await file.read()
        reader = PdfReader(io.BytesIO(file_content))
        total_pages = len(reader.pages)

        # Validate ranges
        validated_ranges = []
        for r in ranges:
            start, end = int(r[0]), int(r[1])
            if start < 1 or end < 1 or start > total_pages or end > total_pages:
                raise HTTPException(
                    status_code=400,
                    detail=f"Page ranges must be between 1 and {total_pages}."
                )
            if start > end:
                raise HTTPException(
                    status_code=400,
                    detail=f"Start page {start} cannot be greater than end page {end}."
                )
            validated_ranges.append((start, end))

        original_filename = file.filename or "document.pdf"
        base_name = original_filename.rsplit(".", 1)[0]

        # If there's only one range, return it directly as PDF
        if len(validated_ranges) == 1:
            start, end = validated_ranges[0]
            writer = PdfWriter()
            for page_num in range(start - 1, end):
                writer.add_page(reader.pages[page_num])
            
            out_io = io.BytesIO()
            writer.write(out_io)
            out_io.seek(0)
            
            return StreamingResponse(
                out_io,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{base_name}_part_{start}_to_{end}.pdf"'}
            )
        
        # If there are multiple ranges, bundle them into a zip file
        zip_io = io.BytesIO()
        with zipfile.ZipFile(zip_io, "w", zipfile.ZIP_DEFLATED) as zf:
            for idx, (start, end) in enumerate(validated_ranges):
                writer = PdfWriter()
                for page_num in range(start - 1, end):
                    writer.add_page(reader.pages[page_num])
                
                pdf_io = io.BytesIO()
                writer.write(pdf_io)
                pdf_io.seek(0)
                
                zf.writestr(f"{base_name}_part_{idx + 1}_{start}_to_{end}.pdf", pdf_io.getvalue())
                
        zip_io.seek(0)
        return StreamingResponse(
            zip_io,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{base_name}_split_parts.zip"'}
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to split PDF: {type(e).__name__}: {str(e)}"
        )

@app.post("/api/merge")
async def merge_pdfs(
    files: List[UploadFile] = File(...)
):
    try:
        if not files or len(files) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 PDF files are required for merging."
            )
            
        merger = PdfWriter()
        
        for file in files:
            file_content = await file.read()
            # Read pdf into merger
            merger.append(io.BytesIO(file_content))
            
        out_io = io.BytesIO()
        merger.write(out_io)
        merger.close()
        out_io.seek(0)
        
        return StreamingResponse(
            out_io,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="merged_documents.pdf"'}
        )
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to merge PDFs: {type(e).__name__}: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
