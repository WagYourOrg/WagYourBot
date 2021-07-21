

export interface WeatherData {
    autoDelete: boolean
}

export interface WeatherResponse {
    weatherdata: {
        "$": {
            "xmlns:xsd": string,
            "xmlns:xsi": string
        }
        weather: {
            "$": {
                "weatherlocationcode": string,
                "weatherlocationname": string,
                "url": string,
                "imagerelativeurl": string,
                "degreetype": "C" | "F",
                "provider": string,
                "attribution": string,
                "attribution2": string,
                "lat": string,
                "long": string,
                "timezone": string,
                "alert": string,
                "entityid": string,
                "encodedlocationname": string
            },
            current: {
                "$": {
                    "temperature": string,
                    "skycode": string,
                    "skytext": string,
                    "date": string,
                    "observationtime": string,
                    "observationpoint": string,
                    "feelslike": string,
                    "humidity": string,
                    "winddisplay": string,
                    "day": string,
                    "shortday": string,
                    "windspeed": string
                }
            }[],
            forecast: {
                "$": {
                    "low": string,
                    "high": string,
                    "skycodeday": string,
                    "skytextday": string,
                    "date": string,
                    "day": string,
                    "shortday": string,
                    "precip": string
                }
            }[]
        }[]
    }
}