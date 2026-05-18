const docx = require('docx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 辅助方法：解析可能的 JSON 结构（9.6 模块）
const parseResult = (resultText) => {
  try {
    let text = resultText.trim();
    if (text.startsWith('```json')) text = text.substring(7);
    else if (text.startsWith('```')) text = text.substring(3);
    if (text.endsWith('```')) text = text.substring(0, text.length - 3);
    const data = JSON.parse(text);
    // 兼容两种结构：
    // 1) 单条结构化：{ hazard_description, basis, suggestion }
    // 2) 多图结构化：{ items: [{ image_id, hazard_description, basis, suggestion }] }
    if (data && typeof data === 'object' && (data.hazard_description || Array.isArray(data.items))) {
      return data;
    }
  } catch (e) {
    // 忽略解析错误
  }
  return null;
};

const docService = {
  /**
   * 生成 Word 报告（支持 9.6 单图/多图结构化结果）
   * @param {string} prompt
   * @param {string} result
   * @param {string|string[]|null} imagePath
   */
  async generateWord(prompt, result, imagePath) {
    const fileName = `result_${Date.now()}.docx`;
    const wordPath = path.join('uploads', fileName);
    const fullPath = path.join(__dirname, '..', wordPath);
    
    // 初始化文档段落
    const children = [
      new docx.Paragraph({
        children: [new docx.TextRun({ text: "智能隐患排查报告", bold: true, size: 32 })],
        alignment: docx.AlignmentType.CENTER,
      }),
      new docx.Paragraph({
        children: [new docx.TextRun({ text: `排查描述：${prompt || '无'}`, size: 24 })],
        spacing: { after: 200 }
      })
    ];

    // 如果有图片，插入图片（支持多张）
    const imageList = Array.isArray(imagePath) ? imagePath : (imagePath ? [imagePath] : []);
    imageList.forEach((p, idx) => {
      if (!p || !fs.existsSync(p)) return;
      try {
        const imageBuffer = fs.readFileSync(p);
        children.push(new docx.Paragraph({
          children: [
            new docx.TextRun({ text: `图片 ${idx + 1}`, bold: true, size: 22 })
          ],
          spacing: { before: 150, after: 100 }
        }));
        children.push(new docx.Paragraph({
          children: [
            new docx.ImageRun({
              data: imageBuffer,
              transformation: { width: 400, height: 300 },
            }),
          ],
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 200 }
        }));
      } catch (e) {
        console.error('Word image insert failed:', e);
      }
    });

    // 判断是否为结构化结果 (9.6 智能分析)
    const structData = parseResult(result);
    if (structData) {
      // 多图结构化：分条输出
      if (Array.isArray(structData.items)) {
        structData.items.forEach((item, idx) => {
          children.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: `隐患分析（${idx + 1}） image_id=${item.image_id || ''}`, bold: true, size: 28 })],
            spacing: { before: 200, after: 120 }
          }));
          children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: "隐患描述：", bold: true, size: 26 })], spacing: { before: 120, after: 80 } }));
          children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: item.hazard_description || '无', size: 24 })] }));
          children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: "排查依据：", bold: true, size: 26 })], spacing: { before: 120, after: 80 } }));
          children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: item.basis || '无', size: 24 })] }));
          children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: "整改建议：", bold: true, size: 26 })], spacing: { before: 120, after: 80 } }));
          children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: item.suggestion || '无', size: 24 })] }));
        });
      } else {
        // 单条结构化
        children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: "隐患描述：", bold: true, size: 28 })], spacing: { before: 200, after: 100 } }));
        children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: structData.hazard_description || '无', size: 24 })] }));
        
        children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: "排查依据：", bold: true, size: 28 })], spacing: { before: 200, after: 100 } }));
        children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: structData.basis || '无', size: 24 })] }));
        
        children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: "整改建议：", bold: true, size: 28 })], spacing: { before: 200, after: 100 } }));
        children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: structData.suggestion || '无', size: 24 })] }));
      }
    } else {
      // 普通文本：按行分割以支持换行
      const lines = (result || '').split('\n');
      lines.forEach(line => {
        children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: line, size: 24 })] }));
      });
    }

    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: children
      }]
    });
    
    const buffer = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
    return wordPath.replace(/\\/g, '/'); // 确保返回正斜杠路径
  },

  /**
   * 生成 PDF 报告（支持 9.6 单图/多图结构化结果）
   * @param {string} prompt
   * @param {string} result
   * @param {string|string[]|null} imagePath
   */
  async generatePDF(prompt, result, imagePath) {
    const fileName = `result_${Date.now()}.pdf`;
    const pdfPath = path.join('uploads', fileName);
    const fullPath = path.join(__dirname, '..', pdfPath);
    
    const pdfDoc = new PDFDocument({ margin: 50 });
    const pdfStream = fs.createWriteStream(fullPath);
    
    const fontPath = 'C:/Windows/Fonts/simhei.ttf';
    if (fs.existsSync(fontPath)) {
      pdfDoc.font(fontPath);
    }

    pdfDoc.pipe(pdfStream);
    pdfDoc.fontSize(20).text('智能隐患排查报告', { align: 'center' });
    pdfDoc.moveDown();
    pdfDoc.fontSize(12).text(`排查描述：${prompt || '无'}`);
    pdfDoc.moveDown();

    const imageList = Array.isArray(imagePath) ? imagePath : (imagePath ? [imagePath] : []);
    imageList.forEach((p, idx) => {
      if (!p || !fs.existsSync(p)) return;
      try {
        pdfDoc.fontSize(12).text(`图片 ${idx + 1}`);
        pdfDoc.moveDown(0.5);
        pdfDoc.image(p, { fit: [400, 300], align: 'center' });
        pdfDoc.moveDown();
      } catch (e) {
        console.error('PDF image insert failed:', e);
      }
    });

    // 判断是否为结构化结果 (9.6 智能分析)
    const structData = parseResult(result);
    if (structData) {
      if (Array.isArray(structData.items)) {
        structData.items.forEach((item, idx) => {
          pdfDoc.fontSize(14).text(`隐患分析（${idx + 1}） image_id=${item.image_id || ''}`);
          pdfDoc.moveDown(0.5);
          pdfDoc.fontSize(13).text('隐患描述：');
          pdfDoc.fontSize(12).text(item.hazard_description || '无').moveDown();
          pdfDoc.fontSize(13).text('排查依据：');
          pdfDoc.fontSize(12).text(item.basis || '无').moveDown();
          pdfDoc.fontSize(13).text('整改建议：');
          pdfDoc.fontSize(12).text(item.suggestion || '无').moveDown();
        });
      } else {
        pdfDoc.fontSize(14).text('隐患描述：');
        pdfDoc.fontSize(12).text(structData.hazard_description || '无').moveDown();
        
        pdfDoc.fontSize(14).text('排查依据：');
        pdfDoc.fontSize(12).text(structData.basis || '无').moveDown();
        
        pdfDoc.fontSize(14).text('整改建议：');
        pdfDoc.fontSize(12).text(structData.suggestion || '无').moveDown();
      }
    } else {
      pdfDoc.fontSize(12).text(result);
    }
    
    pdfDoc.end();

    return new Promise((resolve) => {
      pdfStream.on('finish', () => resolve(pdfPath.replace(/\\/g, '/')));
      pdfStream.on('error', () => resolve(null));
    });
  }
};

module.exports = docService;
