# ZoyBlocks Electron 🚀
Ambiente educacional de robótica da Zoy Educa, programação amigavel por meio de blocos

ZoyBlocks é um projeto que integra **Blockly + Electron**, 
Builder com **Electron_builder**, 
com suporte a um chatbot em **Python + venv + Transforms** para auxiliar no aprendizado.

------------------------------------------------------------------------

## 📦 Preparação do Ambiente

### 1. Clonar o repositório

``` bash
git https://github.com/ZoyEduca/ZoyBlocks_Electron_Live.git
cd ZoyBlocks_Electron_Live
```

### 2. Instalar dependências Node.js

Certifique-se de ter o **Node.js** instalado (versão recomendada v22.19.0).\
Depois, instale as dependências:

``` bash
npm install
```

*(ou `npm i` para a versão curta)*


### 3. Copiar pasta blockly para os arquivos de origem do nosso sistema

Atualmente utilizamos o **blockly: v8.0.5** (ou use versão compatível).
instalamos essa versão que está anotada ao nosso package.json e copiamos ela para nossos arquivos de origem com o comando

``` bash
npm run copy-blockly
```

Obs: esse comando faz parte de um script de automatização presente em nosso package.json
Obs: nosso gitignore vai ignorar a pasta blockly para o repositorio, então é sempre necessario rodar o comando acima quando iniciar o projeto do zero.


### 4. Crie o arquivo .env

Crie um arquivo com nome **.env** e copie o conteudo do arquivo **.env_exemple** nesse novo arquivo **.env** 

### 5. Criar e ativar ambiente virtual (Venv) para o chatbot

O chatbot requer **Python 3.11.9** (ou versão compatível).\
Verifique a versão instalada:

``` bash
python --version
```

Se necessário, baixe em:
[python.org/downloads](https://www.python.org/downloads/).

#### Criar venv
Venv deve ser criado na raiz do projeto(ZoyBlocks_Electron).

``` bash
python -m venv venv
```

#### Ativar venv

-   **Bash (Linux/MacOS):**

    ``` bash
    source venv/bin/activate
    ```

-   **Bash (gitbash com Windowns):**

    ``` bash
    source venv/Scripts/activate
    ```

-   **PowerShell (Windows):**

    ``` powershell
    .\venv\Scripts\activate
    ```

-   **CMD (Windows):**

    ``` cmd
    venv\Scripts\activate
    ```

#### Instalar dependências Python

``` bash
pip install -r requirements.txt
```

#### Instalar manualmente a dependência torch==2.2.1+cpu

``` bash
pip install torch==2.2.1+cpu -f https://download.pytorch.org/whl/cpu/torch_stable.html
```

### 6. Executar o projeto

Para iniciar a aplicação Electron:

``` bash
npm start
```

------------------------------------------------------------------------

## ✅Para criação do builder (Intalador ou executavel)

### Lembre de desativar o Venv de seu ambiente

`deactivate` para gerar instalador

### Agora roda o script de criação

 `npm run dist` para gerar instalador

------------------------------------------------------------------------

📌 Agora você está pronto para rodar o **ZoyBlocks com Electron** 🎉
