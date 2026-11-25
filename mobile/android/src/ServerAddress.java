package ru.mashina.mobile;

import java.net.URI;
import java.util.Locale;

final class ServerAddress {
    private ServerAddress() {}

    static String origin(String input) {
        try {
            URI url = URI.create(input);
            String host = url.getHost();
            String scheme = url.getScheme();
            if (scheme == null || host == null || url.getRawUserInfo() != null
                    || url.getPort() == 0 || url.getPort() > 65535) return null;
            scheme = scheme.toLowerCase(Locale.ROOT);
            if (!scheme.equals("https") && !(scheme.equals("http") && privateIPv4(host))) return null;
            int port = url.getPort();
            int defaultPort = scheme.equals("https") ? 443 : 80;
            return scheme + "://" + host.toLowerCase(Locale.ROOT)
                    + (port == -1 || port == defaultPort ? "" : ":" + port);
        } catch (IllegalArgumentException invalid) {
            return null;
        }
    }

    static String parse(String input) {
        try {
            String address = input.trim();
            boolean bare = !address.contains("://");
            URI url = URI.create(bare ? "https://" + address : address);
            String path = url.getRawPath();
            if (path == null || !(path.isEmpty() || path.equals("/")) || url.getRawUserInfo() != null
                    || url.getRawQuery() != null || url.getRawFragment() != null) return null;
            if (bare && privateIPv4(url.getHost())) {
                int port = url.getPort() == -1 ? 8000 : url.getPort();
                return origin("http://" + url.getHost() + ":" + port);
            }
            return origin(url.toString());
        } catch (IllegalArgumentException invalid) {
            return null;
        }
    }

    private static boolean privateIPv4(String host) {
        if (host == null) return false;
        String[] parts = host.split("\\.", -1);
        if (parts.length != 4) return false;
        int[] octets = new int[4];
        for (int i = 0; i < parts.length; i++) {
            if (!parts[i].matches("0|[1-9][0-9]{0,2}")) return false;
            octets[i] = Integer.parseInt(parts[i]);
            if (octets[i] > 255) return false;
        }
        return octets[0] == 10
                || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
                || (octets[0] == 192 && octets[1] == 168);
    }
}
