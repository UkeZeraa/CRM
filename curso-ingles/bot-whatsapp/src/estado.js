// Persistência simples em arquivo JSON (um registro por aluno).
import fs from "node:fs";
import path from "node:path";

export function criarEstado(arquivo) {
  let dados = { alunos: {} };
  if (fs.existsSync(arquivo)) {
    dados = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  }

  return {
    aluno(telefone, inicioCurso) {
      dados.alunos[telefone] ??= {
        telefone,
        inicioCurso,
        mesManual: null,
        pausado: false,
        ultimaMensagemRecebida: null,
        agenda: null,
        quizAtivo: null,
        historico: [],
        errosRecentes: [],
        pontos: 0,
        sequencia: { dias: 0, ultimaData: null },
      };
      return dados.alunos[telefone];
    },
    salvar() {
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      const temporario = `${arquivo}.tmp`;
      fs.writeFileSync(temporario, JSON.stringify(dados, null, 2));
      fs.renameSync(temporario, arquivo); // troca atômica: não corrompe se o processo cair
    },
  };
}
