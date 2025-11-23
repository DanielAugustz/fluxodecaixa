# Usa o Nginx como servidor web
FROM nginx:latest

# Copia os arquivos estáticos (HTML, CSS, JS) para o diretório de serviço do Nginx
COPY . /usr/share/nginx/html

# A porta 80 é a porta padrão do Nginx dentro do container
EXPOSE 80