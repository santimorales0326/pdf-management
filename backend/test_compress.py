import asyncio
import io
import unittest
from fastapi import HTTPException, UploadFile
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
from main import compress_pdf, compress_pdf_bytes

class CompressionTests(unittest.TestCase):
    def document(self):
        writer = PdfWriter()
        page = writer.add_blank_page(width=200, height=200)
        stream = DecodedStreamObject()
        stream.set_data(b'0 0 m 100 100 l S\n' * 1000)
        page[NameObject('/Contents')] = writer._add_object(stream)
        writer.add_metadata({'/Title': 'Preserved title'})
        writer.add_outline_item('Bookmark', 0)
        output = io.BytesIO()
        writer.write(output)
        return output.getvalue()

    def test_compress_and_preserve(self):
        original = self.document()
        result = compress_pdf_bytes(original)
        self.assertLess(len(result), len(original))
        before, after = PdfReader(io.BytesIO(original)), PdfReader(io.BytesIO(result))
        self.assertEqual(len(after.pages), 1)
        self.assertEqual(before.pages[0].get_contents().get_data(), after.pages[0].get_contents().get_data())
        self.assertEqual(after.metadata.title, 'Preserved title')
        self.assertEqual(after.outline[0].title, 'Bookmark')
        self.assertLessEqual(len(compress_pdf_bytes(result)), len(result))

    def test_original_when_no_savings(self):
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        output = io.BytesIO()
        writer.write(output)
        original = output.getvalue()
        self.assertEqual(compress_pdf_bytes(original), original)

    def test_invalid_and_empty(self):
        for data in (b'', b'not a pdf'):
            with self.assertRaises(HTTPException) as error:
                compress_pdf_bytes(data)
            self.assertEqual(error.exception.status_code, 400)

    def test_encrypted(self):
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.encrypt('secret')
        output = io.BytesIO()
        writer.write(output)
        with self.assertRaises(HTTPException) as error:
            compress_pdf_bytes(output.getvalue())
        self.assertEqual(error.exception.status_code, 400)
        self.assertIn('Unlock', error.exception.detail)

    def test_endpoint(self):
        async def run():
            response = await compress_pdf(UploadFile(filename='résumé.pdf', file=io.BytesIO(self.document())))
            self.assertEqual(response.media_type, 'application/pdf')
            self.assertIn('filename*=UTF-8', response.headers['content-disposition'])
            body = b''.join([part async for part in response.body_iterator])
            self.assertEqual(len(PdfReader(io.BytesIO(body)).pages), 1)
        asyncio.run(run())

if __name__ == '__main__':
    unittest.main()
